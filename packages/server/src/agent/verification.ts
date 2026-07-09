/**
 * Verification: Automatically detects and runs project validation commands
 */

import type { VerificationResult, VerificationInput } from "./types";

/**
 * Detects the project type and returns appropriate verification commands
 */
export async function detectVerificationCommands(
  workspacePath: string,
  readFile: (path: string) => Promise<string>,
  fileExists: (path: string) => Promise<boolean>,
): Promise<{ build?: string; test?: string; lint?: string; typecheck?: string }> {
  const commands: { build?: string; test?: string; lint?: string; typecheck?: string } = {};
  
  try {
    // Check for package.json (Node.js projects)
    if (await fileExists("package.json")) {
      const packageJson = JSON.parse(await readFile("package.json"));
      const scripts = packageJson.scripts || {};
      
      // Detect test command
      if (scripts.test && scripts.test !== 'echo "Error: no test specified" && exit 1') {
        commands.test = "npm test";
      } else if (scripts["test:run"]) {
        commands.test = "npm run test:run";
      }
      
      // Detect build command
      if (scripts.build) {
        commands.build = "npm run build";
      }
      
      // Detect lint command
      if (scripts.lint) {
        commands.lint = "npm run lint";
      }
      
      // Detect typecheck command
      if (scripts.typecheck || scripts["type-check"]) {
        commands.typecheck = scripts.typecheck ? "npm run typecheck" : "npm run type-check";
      }
      
      // Check if using bun
      if (await fileExists("bun.lockb") || await fileExists("bun.lock")) {
        commands.test = commands.test?.replace("npm", "bun");
        commands.build = commands.build?.replace("npm run", "bun run");
        commands.lint = commands.lint?.replace("npm run", "bun run");
        commands.typecheck = commands.typecheck?.replace("npm run", "bun run");
      }
    }
    
    // Check for Cargo.toml (Rust projects)
    if (await fileExists("Cargo.toml")) {
      commands.build = "cargo build";
      commands.test = "cargo test";
      commands.lint = "cargo clippy";
    }
    
    // Check for go.mod (Go projects)
    if (await fileExists("go.mod")) {
      commands.build = "go build ./...";
      commands.test = "go test ./...";
    }
    
    // Check for pom.xml or build.gradle (Java projects)
    if (await fileExists("pom.xml")) {
      commands.build = "mvn compile";
      commands.test = "mvn test";
    } else if (await fileExists("build.gradle") || await fileExists("build.gradle.kts")) {
      commands.build = "./gradlew build";
      commands.test = "./gradlew test";
    }
    
    // Check for requirements.txt or pyproject.toml (Python projects)
    if (await fileExists("pyproject.toml")) {
      const content = await readFile("pyproject.toml");
      if (content.includes("pytest")) {
        commands.test = "pytest";
      }
    } else if (await fileExists("requirements.txt")) {
      const content = await readFile("requirements.txt");
      if (content.includes("pytest")) {
        commands.test = "pytest";
      }
    }
    
  } catch (error) {
    console.error("Error detecting verification commands:", error);
  }
  
  return commands;
}

/**
 * Runs a verification command and parses the result
 */
export async function runVerification(
  command: string,
  type: VerificationResult["type"],
  execBash: (cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>,
  timeout: number = 120000, // 2 minutes default
): Promise<VerificationResult> {
  try {
    const result = await execBash(command, timeout);
    
    const passed = result.exitCode === 0;
    const errors = passed ? undefined : parseErrors(result.stdout + "\n" + result.stderr, type);
    
    return {
      passed,
      type,
      command,
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      errors,
    };
  } catch (error) {
    return {
      passed: false,
      type,
      command,
      exitCode: -1,
      stdout: "",
      stderr: error instanceof Error ? error.message : String(error),
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
}

/**
 * Parses error messages from command output
 */
function parseErrors(output: string, type: VerificationResult["type"]): string[] {
  const errors: string[] = [];
  const lines = output.split("\n");
  
  switch (type) {
    case "test":
      // Parse test failures
      for (const line of lines) {
        if (
          line.includes("FAIL") ||
          line.includes("Error:") ||
          line.includes("AssertionError") ||
          line.includes("✗") ||
          line.includes("failed") ||
          line.includes("FAILED")
        ) {
          errors.push(line.trim());
        }
      }
      break;
      
    case "build":
      // Parse build errors
      for (const line of lines) {
        if (
          line.includes("error:") ||
          line.includes("ERROR") ||
          line.includes("Error:") ||
          line.includes("cannot find") ||
          line.includes("undefined")
        ) {
          errors.push(line.trim());
        }
      }
      break;
      
    case "lint":
      // Parse lint errors
      for (const line of lines) {
        if (
          line.includes("error") ||
          line.includes("warning") ||
          line.match(/\d+:\d+/)  // line:column pattern
        ) {
          errors.push(line.trim());
        }
      }
      break;
      
    case "typecheck":
      // Parse type errors
      for (const line of lines) {
        if (
          line.includes("error TS") ||
          line.includes("Type error") ||
          line.includes("type mismatch")
        ) {
          errors.push(line.trim());
        }
      }
      break;
  }
  
  // Limit error count
  return errors.slice(0, 20);
}

/**
 * Determines which verifications to run based on modified files
 */
export function selectVerifications(
  modifiedFiles: string[],
  availableCommands: { build?: string; test?: string; lint?: string; typecheck?: string },
): { command: string; type: VerificationResult["type"] }[] {
  const verifications: { command: string; type: VerificationResult["type"] }[] = [];
  
  const hasCodeFiles = modifiedFiles.some(f => 
    f.endsWith(".ts") ||
    f.endsWith(".tsx") ||
    f.endsWith(".js") ||
    f.endsWith(".jsx") ||
    f.endsWith(".py") ||
    f.endsWith(".rs") ||
    f.endsWith(".go") ||
    f.endsWith(".java")
  );
  
  const hasTypeScriptFiles = modifiedFiles.some(f => 
    f.endsWith(".ts") || f.endsWith(".tsx")
  );
  
  const hasTestFiles = modifiedFiles.some(f =>
    f.includes(".test.") ||
    f.includes(".spec.") ||
    f.includes("__tests__")
  );
  
  // Run typecheck for TypeScript files
  if (hasTypeScriptFiles && availableCommands.typecheck) {
    verifications.push({
      command: availableCommands.typecheck,
      type: "typecheck",
    });
  }
  
  // Run build if available and code files changed
  if (hasCodeFiles && availableCommands.build) {
    verifications.push({
      command: availableCommands.build,
      type: "build",
    });
  }
  
  // Run tests if available and relevant files changed
  if ((hasCodeFiles || hasTestFiles) && availableCommands.test) {
    verifications.push({
      command: availableCommands.test,
      type: "test",
    });
  }
  
  // Run lint if available and code files changed
  if (hasCodeFiles && availableCommands.lint) {
    verifications.push({
      command: availableCommands.lint,
      type: "lint",
    });
  }
  
  return verifications;
}

/**
 * Runs all appropriate verifications for modified files
 */
export async function verifyChanges(
  input: VerificationInput,
  execBash: (cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>,
  readFile: (path: string) => Promise<string>,
  fileExists: (path: string) => Promise<boolean>,
): Promise<VerificationResult[]> {
  const { modifiedFiles, workspaceId } = input;
  
  // Detect available commands
  const availableCommands = await detectVerificationCommands(
    workspaceId,
    readFile,
    fileExists,
  );
  
  // Select which verifications to run
  const verificationsToRun = selectVerifications(modifiedFiles, availableCommands);
  
  if (verificationsToRun.length === 0) {
    return [];
  }
  
  // Run verifications
  const results: VerificationResult[] = [];
  
  for (const { command, type } of verificationsToRun) {
    const result = await runVerification(command, type, execBash);
    results.push(result);
  }
  
  return results;
}

/**
 * Formats verification results for display
 */
export function formatVerificationResults(results: VerificationResult[]): string {
  if (results.length === 0) {
    return "No verifications run.";
  }
  
  let output = "## Verification Results\n\n";
  
  for (const result of results) {
    const icon = result.passed ? "✔" : "✗";
    output += `${icon} **${result.type}**: ${result.command}\n`;
    
    if (!result.passed && result.errors && result.errors.length > 0) {
      output += `\nErrors:\n`;
      result.errors.slice(0, 5).forEach(error => {
        output += `  - ${error}\n`;
      });
      
      if (result.errors.length > 5) {
        output += `  ... and ${result.errors.length - 5} more errors\n`;
      }
    }
    
    output += `\n`;
  }
  
  return output;
}

/**
 * Checks if any verification failed
 */
export function hasVerificationFailures(results: VerificationResult[]): boolean {
  return results.some(r => !r.passed);
}

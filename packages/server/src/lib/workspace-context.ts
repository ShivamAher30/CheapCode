/**
 * Workspace Context Extractor
 * 
 * Extracts relevant workspace information for prompt enrichment.
 * Provides focused context without sending entire file system.
 */

import { readdir, readFile, stat } from "fs/promises";
import { join, extname, basename } from "path";
import { getWorkspace } from "../routes/workspaces.js";

/**
 * Workspace context information used for enrichment
 */
export type WorkspaceContext = {
  /** Detected technologies (e.g., ["React", "TypeScript", "Node.js"]) */
  technologies: string[];
  
  /** Brief overview of project structure */
  fileStructureSummary: string;
  
  /** Recently accessed/modified files */
  recentFiles: string[];
  
  /** Project name if detectable */
  projectName?: string;
};

/**
 * Cache for workspace contexts to avoid repeated extraction
 */
const contextCache = new Map<string, { context: WorkspaceContext; timestamp: number }>();

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Maximum depth for directory traversal
 */
const MAX_DEPTH = 3;

/**
 * Maximum number of recent files to track
 */
const MAX_RECENT_FILES = 10;

/**
 * Get workspace context with caching
 * 
 * @param workspaceId - Workspace identifier
 * @returns WorkspaceContext with technologies, structure, and recent files
 */
export async function getWorkspaceContext(
  workspaceId: string
): Promise<WorkspaceContext> {
  // Check cache first
  const cached = contextCache.get(workspaceId);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.context;
  }

  // Get workspace
  const workspace = getWorkspace(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }

  const workspacePath = workspace.path;

  // Extract context
  const context: WorkspaceContext = {
    technologies: await extractTechnologies(workspacePath),
    fileStructureSummary: await generateFileStructureSummary(workspacePath),
    recentFiles: await getRecentFiles(workspacePath),
    projectName: await extractProjectName(workspacePath),
  };

  // Cache the result
  contextCache.set(workspaceId, {
    context,
    timestamp: Date.now(),
  });

  return context;
}

/**
 * Extract technologies from package.json, dependencies, and file extensions
 * 
 * @param workspacePath - Path to workspace directory
 * @returns Array of detected technologies
 */
async function extractTechnologies(workspacePath: string): Promise<string[]> {
  const technologies = new Set<string>();

  try {
    // Read package.json if it exists
    const packageJsonPath = join(workspacePath, "package.json");
    try {
      const packageJsonContent = await readFile(packageJsonPath, "utf-8");
      const packageJson = JSON.parse(packageJsonContent);

      // Check for specific dependencies and frameworks
      const allDeps = {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
      };

      // Detect frameworks and libraries
      if (allDeps["react"]) technologies.add("React");
      if (allDeps["vue"]) technologies.add("Vue");
      if (allDeps["@angular/core"]) technologies.add("Angular");
      if (allDeps["next"]) technologies.add("Next.js");
      if (allDeps["svelte"]) technologies.add("Svelte");
      if (allDeps["express"]) technologies.add("Express");
      if (allDeps["hono"]) technologies.add("Hono");
      if (allDeps["fastify"]) technologies.add("Fastify");
      if (allDeps["typescript"]) technologies.add("TypeScript");
      if (allDeps["vite"]) technologies.add("Vite");
      if (allDeps["webpack"]) technologies.add("Webpack");
      if (allDeps["tailwindcss"]) technologies.add("Tailwind CSS");
      if (allDeps["prisma"]) technologies.add("Prisma");
      if (allDeps["mongoose"]) technologies.add("MongoDB");
      if (allDeps["postgresql"] || allDeps["pg"]) technologies.add("PostgreSQL");
      if (allDeps["mysql"] || allDeps["mysql2"]) technologies.add("MySQL");

      // Detect runtime
      if (packageJson.type === "module") {
        technologies.add("ES Modules");
      }
    } catch {
      // package.json doesn't exist or is invalid
    }

    // Detect file extensions
    const extensions = await detectFileExtensions(workspacePath);
    if (extensions.has(".ts") || extensions.has(".tsx")) {
      technologies.add("TypeScript");
    }
    if (extensions.has(".js") || extensions.has(".jsx")) {
      technologies.add("JavaScript");
    }
    if (extensions.has(".py")) {
      technologies.add("Python");
    }
    if (extensions.has(".java")) {
      technologies.add("Java");
    }
    if (extensions.has(".go")) {
      technologies.add("Go");
    }
    if (extensions.has(".rs")) {
      technologies.add("Rust");
    }
    if (extensions.has(".cpp") || extensions.has(".cc") || extensions.has(".cxx")) {
      technologies.add("C++");
    }
    if (extensions.has(".c")) {
      technologies.add("C");
    }
    if (extensions.has(".rb")) {
      technologies.add("Ruby");
    }
    if (extensions.has(".php")) {
      technologies.add("PHP");
    }
    if (extensions.has(".cs")) {
      technologies.add("C#");
    }

    // Always add Node.js if package.json exists
    if (technologies.size > 0 && extensions.has(".json")) {
      technologies.add("Node.js");
    }
  } catch (error) {
    // If we can't access the workspace, return empty
    console.error(`Error extracting technologies: ${error}`);
  }

  return Array.from(technologies);
}

/**
 * Detect file extensions present in the workspace
 * 
 * @param dirPath - Directory to scan
 * @param depth - Current recursion depth
 * @returns Set of file extensions found
 */
async function detectFileExtensions(
  dirPath: string,
  depth: number = 0
): Promise<Set<string>> {
  const extensions = new Set<string>();

  if (depth > MAX_DEPTH) {
    return extensions;
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      // Skip node_modules, .git, and other common ignore patterns
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);

      if (entry.isFile()) {
        const ext = extname(entry.name);
        if (ext) {
          extensions.add(ext);
        }
      } else if (entry.isDirectory()) {
        const subExtensions = await detectFileExtensions(fullPath, depth + 1);
        subExtensions.forEach((ext) => extensions.add(ext));
      }
    }
  } catch (error) {
    // Directory might not be accessible
  }

  return extensions;
}

/**
 * Generate a brief file structure summary
 * 
 * @param workspacePath - Path to workspace directory
 * @returns Brief description of project structure
 */
async function generateFileStructureSummary(
  workspacePath: string
): Promise<string> {
  const summary: string[] = [];

  try {
    const entries = await readdir(workspacePath, { withFileTypes: true });
    const dirs = entries.filter((e) => e.isDirectory() && !shouldSkipDirectory(e.name));
    const files = entries.filter((e) => e.isFile());

    // Common project structures
    const hasPackageJson = files.some((f) => f.name === "package.json");
    const hasSrcDir = dirs.some((d) => d.name === "src");
    const hasPublicDir = dirs.some((d) => d.name === "public");
    const hasTestDir = dirs.some((d) => d.name === "test" || d.name === "tests" || d.name === "__tests__");
    const hasDocsDir = dirs.some((d) => d.name === "docs");
    const hasPackagesDir = dirs.some((d) => d.name === "packages");

    if (hasPackageJson) {
      summary.push("Node.js project");
    }

    if (hasPackagesDir) {
      summary.push("monorepo structure");
    }

    if (hasSrcDir) {
      summary.push("source in /src");
    }

    if (hasPublicDir) {
      summary.push("public assets in /public");
    }

    if (hasTestDir) {
      summary.push("tests present");
    }

    if (hasDocsDir) {
      summary.push("documentation in /docs");
    }

    // Count top-level directories
    const topLevelDirs = dirs.length;
    if (topLevelDirs > 0) {
      summary.push(`${topLevelDirs} top-level directories`);
    }

    return summary.length > 0 ? summary.join(", ") : "Standard project structure";
  } catch (error) {
    return "Unable to access project structure";
  }
}

/**
 * Get recently accessed/modified files
 * 
 * @param workspacePath - Path to workspace directory
 * @returns Array of recently modified file paths (relative)
 */
async function getRecentFiles(workspacePath: string): Promise<string[]> {
  const recentFiles: { path: string; mtime: Date }[] = [];

  try {
    await collectRecentFiles(workspacePath, workspacePath, recentFiles);

    // Sort by modification time (most recent first)
    recentFiles.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    // Return top N most recent files
    return recentFiles.slice(0, MAX_RECENT_FILES).map((f) => f.path);
  } catch (error) {
    return [];
  }
}

/**
 * Recursively collect recent files
 * 
 * @param dirPath - Current directory path
 * @param basePath - Base workspace path for relative paths
 * @param recentFiles - Array to collect results
 * @param depth - Current recursion depth
 */
async function collectRecentFiles(
  dirPath: string,
  basePath: string,
  recentFiles: { path: string; mtime: Date }[],
  depth: number = 0
): Promise<void> {
  if (depth > MAX_DEPTH) {
    return;
  }

  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (shouldSkipDirectory(entry.name)) {
        continue;
      }

      const fullPath = join(dirPath, entry.name);

      if (entry.isFile()) {
        // Skip non-code files
        if (shouldIncludeFile(entry.name)) {
          try {
            const stats = await stat(fullPath);
            const relativePath = fullPath.substring(basePath.length + 1);
            recentFiles.push({
              path: relativePath,
              mtime: stats.mtime,
            });
          } catch {
            // Skip files we can't stat
          }
        }
      } else if (entry.isDirectory()) {
        await collectRecentFiles(fullPath, basePath, recentFiles, depth + 1);
      }
    }
  } catch {
    // Directory not accessible
  }
}

/**
 * Extract project name from package.json or directory name
 * 
 * @param workspacePath - Path to workspace directory
 * @returns Project name if found
 */
async function extractProjectName(workspacePath: string): Promise<string | undefined> {
  try {
    const packageJsonPath = join(workspacePath, "package.json");
    const packageJsonContent = await readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(packageJsonContent);

    if (packageJson.name) {
      return packageJson.name;
    }
  } catch {
    // package.json doesn't exist or is invalid
  }

  // Fallback to directory name
  return basename(workspacePath);
}

/**
 * Check if a directory should be skipped during traversal
 * 
 * @param name - Directory name
 * @returns true if directory should be skipped
 */
function shouldSkipDirectory(name: string): boolean {
  const skipPatterns = [
    "node_modules",
    ".git",
    ".svn",
    ".hg",
    "dist",
    "build",
    "out",
    "target",
    ".next",
    ".nuxt",
    "coverage",
    ".cache",
    ".temp",
    ".tmp",
    "vendor",
    "__pycache__",
  ];

  return skipPatterns.includes(name) || name.startsWith(".");
}

/**
 * Check if a file should be included in recent files
 * 
 * @param name - File name
 * @returns true if file should be included
 */
function shouldIncludeFile(name: string): boolean {
  const codeExtensions = [
    ".ts",
    ".tsx",
    ".js",
    ".jsx",
    ".py",
    ".java",
    ".go",
    ".rs",
    ".c",
    ".cpp",
    ".h",
    ".hpp",
    ".cs",
    ".rb",
    ".php",
    ".swift",
    ".kt",
    ".scala",
    ".vue",
    ".svelte",
    ".html",
    ".css",
    ".scss",
    ".sass",
    ".less",
  ];

  const ext = extname(name);
  return codeExtensions.includes(ext);
}

/**
 * Clear the context cache (useful for testing)
 */
export function clearContextCache(): void {
  contextCache.clear();
}

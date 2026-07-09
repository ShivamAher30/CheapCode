/**
 * Repair: Creates repair tasks for failed verifications
 */

import {
  TaskStatus,
  TaskType,
  type Task,
  type VerificationResult,
  type RepairInput,
} from "./types";

/**
 * Creates a repair task from a failed verification
 */
export function createRepairTask(input: RepairInput): Task {
  const { originalTask, verification, affectedFiles } = input;
  
  const taskId = `repair-${originalTask.id}-${Date.now()}`;
  
  let description = `Fix ${verification.type} failures from task "${originalTask.title}".\n\n`;
  description += `**Failed Command:** ${verification.command}\n`;
  description += `**Exit Code:** ${verification.exitCode}\n\n`;
  
  if (verification.errors && verification.errors.length > 0) {
    description += `**Errors:**\n`;
    verification.errors.slice(0, 10).forEach(error => {
      description += `- ${error}\n`;
    });
    
    if (verification.errors.length > 10) {
      description += `... and ${verification.errors.length - 10} more errors\n`;
    }
  }
  
  if (affectedFiles.length > 0) {
    description += `\n**Files to check:**\n`;
    affectedFiles.forEach(file => {
      description += `- ${file}\n`;
    });
  }
  
  description += `\nAnalyze the errors and fix the issues. Re-run verification to confirm.`;
  
  const task: Task = {
    id: taskId,
    title: `Repair: ${originalTask.title}`,
    description,
    status: TaskStatus.PENDING,
    type: "repair" as TaskType,
    dependencies: [originalTask.id],
    retryCount: 0,
    maxRetries: 2, // Fewer retries for repair tasks
    createdAt: Date.now(),
  };
  
  return task;
}

/**
 * Analyzes verification failures to determine if repair is possible
 */
export function shouldCreateRepairTask(
  verification: VerificationResult,
  taskRetryCount: number,
): boolean {
  // Don't create repair for tasks that have already been retried multiple times
  if (taskRetryCount >= 2) {
    return false;
  }
  
  // Don't create repair for timeout or system errors
  if (verification.exitCode === -1) {
    return false;
  }
  
  // Don't create repair if there are no specific errors to fix
  if (!verification.errors || verification.errors.length === 0) {
    return false;
  }
  
  // Create repair for code-related errors
  if (verification.type === "build" || verification.type === "typecheck" || verification.type === "test") {
    return true;
  }
  
  // For lint errors, only create repair if there are actual errors (not just warnings)
  if (verification.type === "lint") {
    return verification.errors.some(e => 
      e.toLowerCase().includes("error") && !e.toLowerCase().includes("warning")
    );
  }
  
  return false;
}

/**
 * Extracts file paths mentioned in error messages
 */
export function extractAffectedFiles(verification: VerificationResult): string[] {
  const files = new Set<string>();
  
  if (!verification.errors) {
    return [];
  }
  
  for (const error of verification.errors) {
    // Match common file path patterns in error messages
    const patterns = [
      // Matches: "path/to/file.ts:10:5"
      /([a-zA-Z0-9_\-./]+\.[a-zA-Z]+):\d+:\d+/g,
      // Matches: "at path/to/file.ts"
      /at ([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/g,
      // Matches: "in path/to/file.ts"
      /in ([a-zA-Z0-9_\-./]+\.[a-zA-Z]+)/g,
      // Matches: "path/to/file.ts"
      /([a-zA-Z0-9_\-./]+\.(ts|tsx|js|jsx|py|rs|go|java))/g,
    ];
    
    for (const pattern of patterns) {
      const matches = error.matchAll(pattern);
      for (const match of matches) {
        const filePath = match[1];
        if (filePath && !filePath.startsWith("node_modules")) {
          files.add(filePath);
        }
      }
    }
  }
  
  return Array.from(files);
}

/**
 * Prioritizes which verification failure to repair first
 */
export function prioritizeRepairs(verifications: VerificationResult[]): VerificationResult | null {
  const failed = verifications.filter(v => !v.passed);
  
  if (failed.length === 0) {
    return null;
  }
  
  // Priority order: typecheck > build > test > lint
  const priority = ["typecheck", "build", "test", "lint"];
  
  for (const type of priority) {
    const verification = failed.find(v => v.type === type);
    if (verification) {
      return verification;
    }
  }
  
  return failed[0];
}

/**
 * Creates repair tasks for multiple verification failures
 */
export function createRepairTasks(
  originalTask: Task,
  verifications: VerificationResult[],
): Task[] {
  const failedVerifications = verifications.filter(v => !v.passed);
  const repairTasks: Task[] = [];
  
  for (const verification of failedVerifications) {
    if (!shouldCreateRepairTask(verification, originalTask.retryCount)) {
      continue;
    }
    
    const affectedFiles = extractAffectedFiles(verification);
    
    const repairTask = createRepairTask({
      originalTask,
      verification,
      affectedFiles,
    });
    
    repairTasks.push(repairTask);
  }
  
  return repairTasks;
}

/**
 * Formats repair guidance for the LLM
 */
export function formatRepairGuidance(verification: VerificationResult): string {
  let guidance = `# Repair Guidance\n\n`;
  guidance += `The ${verification.type} verification failed. Here's what you need to fix:\n\n`;
  
  if (verification.type === "typecheck") {
    guidance += `**Type Errors:**\n`;
    guidance += `- Review the type errors below\n`;
    guidance += `- Fix type mismatches, missing types, or incorrect type usage\n`;
    guidance += `- Consider updating interfaces/types if necessary\n\n`;
  } else if (verification.type === "build") {
    guidance += `**Build Errors:**\n`;
    guidance += `- Review the compilation errors below\n`;
    guidance += `- Fix syntax errors, import issues, or missing dependencies\n`;
    guidance += `- Ensure all files are properly structured\n\n`;
  } else if (verification.type === "test") {
    guidance += `**Test Failures:**\n`;
    guidance += `- Review the failing tests below\n`;
    guidance += `- Fix the code to make tests pass\n`;
    guidance += `- Or update tests if requirements changed\n\n`;
  } else if (verification.type === "lint") {
    guidance += `**Lint Errors:**\n`;
    guidance += `- Review the lint violations below\n`;
    guidance += `- Fix code style issues\n`;
    guidance += `- Follow the project's coding standards\n\n`;
  }
  
  if (verification.errors && verification.errors.length > 0) {
    guidance += `## Errors\n\n`;
    verification.errors.forEach((error, i) => {
      guidance += `${i + 1}. ${error}\n`;
    });
  }
  
  guidance += `\n## Strategy\n`;
  guidance += `1. Read the affected files\n`;
  guidance += `2. Understand the root cause\n`;
  guidance += `3. Make targeted fixes\n`;
  guidance += `4. Verification will run automatically\n`;
  
  return guidance;
}

/**
 * Determines if a task is a repair task
 */
export function isRepairTask(task: Task): boolean {
  return task.type === "repair" || task.title.startsWith("Repair:");
}

/**
 * Gets the original task for a repair task
 */
export function getOriginalTaskId(repairTask: Task): string | null {
  if (!isRepairTask(repairTask)) {
    return null;
  }
  
  // Repair tasks depend on their original task
  if (repairTask.dependencies.length > 0) {
    return repairTask.dependencies[0];
  }
  
  return null;
}

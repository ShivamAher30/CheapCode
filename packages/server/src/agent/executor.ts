/**
 * Executor: Executes individual tasks using the LLM and tools
 */

import { generateText } from "ai";
import type { LanguageModel, InferUITools } from "ai";
import type { ToolContracts } from "@localcode/shared";
import type {
  Task,
  ExecutorInput,
  ExecutorOutput,
  TaskResult,
} from "./types";

/**
 * Builds the execution prompt for a task
 */
function buildExecutionPrompt(input: ExecutorInput): string {
  const { task, context } = input;
  
  let prompt = `You are executing a specific task as part of a larger goal.

## Overall Goal
${context.goal}

## Your Current Task
**${task.title}**

${task.description}

## Context
`;

  if (context.completedTasks.length > 0) {
    prompt += `\n### Previously Completed Tasks\n`;
    context.completedTasks.forEach((t, i) => {
      prompt += `${i + 1}. ${t.title}\n`;
      if (t.result?.summary) {
        prompt += `   ${t.result.summary}\n`;
      }
    });
  }
  
  if (Object.keys(context.dependencyResults).length > 0) {
    prompt += `\n### Results from Dependencies\n`;
    Object.entries(context.dependencyResults).forEach(([taskId, result]) => {
      const depTask = context.completedTasks.find(t => t.id === taskId);
      if (depTask) {
        prompt += `\n**${depTask.title}:**\n`;
        prompt += `${result.summary}\n`;
        if (result.modifiedFiles && result.modifiedFiles.length > 0) {
          prompt += `Modified files: ${result.modifiedFiles.join(", ")}\n`;
        }
      }
    });
  }

  prompt += `\n## Instructions

Focus ONLY on this specific task. Do not try to accomplish other tasks.

`;

  if (task.type === "analyze") {
    prompt += `This is an **analysis task**. Your goal is to understand the code and provide insights.
- Use readFile, listDirectory, glob, and grep to explore
- Provide a clear summary of your findings
- Identify key files, patterns, or issues
- Do NOT make any modifications

`;
  } else if (task.type === "modify") {
    prompt += `This is a **modification task**. Your goal is to make the necessary code changes.
- First, understand the current code (read relevant files)
- Make targeted, precise changes using editFile or writeFile
- Keep changes minimal and focused on the task
- Track which files you modify

`;
  } else if (task.type === "verify") {
    prompt += `This is a **verification task**. Your goal is to validate that things work correctly.
- Run appropriate tests or builds using bash
- Check that verification passes
- Report results clearly

`;
  } else if (task.type === "repair") {
    prompt += `This is a **repair task**. Something failed and needs fixing.
- Read the error details carefully
- Understand the root cause
- Make minimal fixes to resolve the issue
- The system will automatically re-run verification

`;
  }

  prompt += `When you're done with this task, provide a brief summary of what you accomplished.

Remember: Focus on THIS task only. Quality over speed.`;

  return prompt;
}

/**
 * Extracts modified files from tool call results
 */
function extractModifiedFiles(toolResults: Array<{ toolName: string; args: Record<string, unknown> }>): string[] {
  const modifiedFiles = new Set<string>();
  
  for (const call of toolResults) {
    if (call.toolName === "writeFile" || call.toolName === "editFile") {
      const path = call.args.path as string;
      if (path) {
        modifiedFiles.add(path);
      }
    }
  }
  
  return Array.from(modifiedFiles);
}

/**
 * Determines if task needs verification based on what it did
 */
function needsVerification(task: Task, modifiedFiles: string[]): boolean {
  // Only modification and repair tasks need verification
  if (task.type !== "modify" && task.type !== "repair") {
    return false;
  }
  
  // Only if files were actually modified
  if (modifiedFiles.length === 0) {
    return false;
  }
  
  // Check if any code files were modified
  const codeFileExtensions = [".ts", ".tsx", ".js", ".jsx", ".py", ".rs", ".go", ".java", ".c", ".cpp", ".h"];
  const hasCodeFiles = modifiedFiles.some(file => 
    codeFileExtensions.some(ext => file.endsWith(ext))
  );
  
  return hasCodeFiles;
}

/**
 * Executes a single task
 */
export async function executeTask(
  model: LanguageModel,
  tools: InferUITools<ToolContracts>,
  input: ExecutorInput,
): Promise<ExecutorOutput> {
  const { task } = input;
  
  const prompt = buildExecutionPrompt(input);
  
  // Track tool calls
  const toolCalls: Array<{ toolName: string; args: Record<string, unknown> }> = [];
  
  try {
    // Execute with the LLM
    const result = await generateText({
      model,
      prompt,
      tools,
      maxSteps: 15, // Allow multiple tool calls
      onStepFinish(event) {
        // Track tool calls
        if (event.toolCalls && event.toolCalls.length > 0) {
          for (const call of event.toolCalls) {
            toolCalls.push({
              toolName: call.toolName,
              args: call.args as Record<string, unknown>,
            });
          }
        }
      },
    });
    
    const modifiedFiles = extractModifiedFiles(toolCalls);
    const shouldVerify = needsVerification(task, modifiedFiles);
    
    // Extract summary from the final text
    const summary = result.text || "Task completed";
    
    // Build task result
    const taskResult: TaskResult = {
      success: true,
      summary,
      modifiedFiles: modifiedFiles.length > 0 ? modifiedFiles : undefined,
      executedCommands: toolCalls
        .filter(call => call.toolName === "bash")
        .map(call => call.args.command as string),
      metadata: {
        toolCallCount: toolCalls.length,
        steps: result.steps?.length || 0,
      },
    };
    
    const updatedTask: Task = {
      ...task,
      result: taskResult,
    };
    
    return {
      task: updatedTask,
      modifiedFiles,
      needsVerification: shouldVerify,
    };
    
  } catch (error) {
    // Task execution failed
    const errorMessage = error instanceof Error ? error.message : String(error);
    
    const taskResult: TaskResult = {
      success: false,
      summary: `Task failed: ${errorMessage}`,
      modifiedFiles: [],
      metadata: {
        error: errorMessage,
      },
    };
    
    const updatedTask: Task = {
      ...task,
      result: taskResult,
      error: errorMessage,
    };
    
    return {
      task: updatedTask,
      modifiedFiles: [],
      needsVerification: false,
    };
  }
}

/**
 * Validates that a task execution was successful
 */
export function validateTaskExecution(output: ExecutorOutput): { valid: boolean; error?: string } {
  if (!output.task.result) {
    return { valid: false, error: "Task has no result" };
  }
  
  if (!output.task.result.success) {
    return { valid: false, error: output.task.result.summary };
  }
  
  return { valid: true };
}

/**
 * Formats task result for display
 */
export function formatTaskResult(task: Task): string {
  if (!task.result) {
    return "No result available";
  }
  
  let output = `**${task.title}**\n\n`;
  output += `${task.result.summary}\n`;
  
  if (task.result.modifiedFiles && task.result.modifiedFiles.length > 0) {
    output += `\nModified files:\n`;
    task.result.modifiedFiles.forEach(file => {
      output += `- ${file}\n`;
    });
  }
  
  if (task.result.executedCommands && task.result.executedCommands.length > 0) {
    output += `\nExecuted commands:\n`;
    task.result.executedCommands.forEach(cmd => {
      output += `- ${cmd}\n`;
    });
  }
  
  if (task.result.verification) {
    const icon = task.result.verification.passed ? "✔" : "✗";
    output += `\nVerification: ${icon} ${task.result.verification.type}\n`;
  }
  
  return output;
}

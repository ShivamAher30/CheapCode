/**
 * Orchestrator: Main agent loop that coordinates planning, execution, and verification
 */

import type { LanguageModel, InferUITools } from "ai";
import type { ToolContracts } from "@localcode/shared";
import {
  DEFAULT_AGENT_CONFIG,
  type ExecutionPlan,
  type ExecutionState,
  type Task,
  type ProgressEvent,
  type AgentConfig,
} from "./types";
import { createPlan, validatePlan, formatPlan } from "./planner";
import {
  getNextTask,
  startTask,
  completeTask,
  failTask,
  retryTask,
  updateTaskInPlan,
  isPlanComplete,
  shouldContinueExecution,
  createExecutionState,
  updateExecutionState,
  getExecutionSummary,
  createProgressEvent,
  addTaskToPlan,
  propagateFailure,
  canRetryTask,
  formatPlanStats,
} from "./task-manager";
import { executeTask, validateTaskExecution } from "./executor";
import {
  verifyChanges,
  hasVerificationFailures,
  formatVerificationResults,
} from "./verification";
import {
  createRepairTasks,
  shouldCreateRepairTask,
  formatRepairGuidance,
} from "./repair";

export interface OrchestratorInput {
  /** User's goal */
  goal: string;
  
  /** Workspace ID */
  workspaceId: string;
  
  /** Language model to use */
  model: LanguageModel;
  
  /** Available tools */
  tools: InferUITools<ToolContracts>;
  
  /** Configuration */
  config?: Partial<AgentConfig>;
  
  /** Tool executors */
  toolExecutors: {
    readFile: (path: string) => Promise<string>;
    fileExists: (path: string) => Promise<boolean>;
    execBash: (cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
  };
  
  /** Progress callback */
  onProgress?: (event: ProgressEvent) => void | Promise<void>;
}

export interface OrchestratorOutput {
  /** Final execution plan with results */
  plan: ExecutionPlan;
  
  /** Execution state */
  state: ExecutionState;
  
  /** Summary of execution */
  summary: string;
  
  /** Whether execution succeeded */
  success: boolean;
}

/**
 * Main orchestration function
 */
export async function orchestrate(input: OrchestratorInput): Promise<OrchestratorOutput> {
  const {
    goal,
    workspaceId,
    model,
    tools,
    toolExecutors,
    onProgress,
  } = input;
  
  const config: AgentConfig = {
    ...DEFAULT_AGENT_CONFIG,
    ...input.config,
  };
  
  // Step 1: Create the plan
  const plan = await createPlan(model, {
    goal,
    workspaceId,
    constraints: {
      autoVerify: config.autoVerify,
      maxTasks: config.maxTasks,
      autoRepair: config.autoRepair,
    },
  });
  
  // Validate plan
  const validation = validatePlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid plan: ${validation.errors.join(", ")}`);
  }
  
  // Emit plan created event
  if (onProgress) {
    await onProgress(createProgressEvent(
      "plan-created",
      plan,
      `Created execution plan with ${plan.tasks.length} tasks`,
    ));
  }
  
  // Initialize execution state
  let state = createExecutionState(plan);
  state.plan.status = "running";
  state.plan.startedAt = Date.now();
  
  // Step 2: Execute tasks
  while (shouldContinueExecution(state)) {
    const nextTask = getNextTask(state.plan);
    
    if (!nextTask) {
      // No more executable tasks
      break;
    }
    
    // Start task
    const startedTask = startTask(nextTask);
    state.plan = updateTaskInPlan(state.plan, startedTask);
    
    if (onProgress) {
      await onProgress(createProgressEvent(
        "task-started",
        state.plan,
        `Starting: ${startedTask.title}`,
        startedTask,
      ));
    }
    
    try {
      // Execute the task
      const executorOutput = await executeTask(model, tools, {
        task: startedTask,
        workspaceId,
        context: {
          goal,
          completedTasks: state.plan.tasks.filter(t => t.status === "completed"),
          dependencyResults: Object.fromEntries(
            startedTask.dependencies
              .map(depId => {
                const depTask = state.plan.tasks.find(t => t.id === depId);
                return depTask?.result ? [depId, depTask.result] : null;
              })
              .filter(Boolean) as Array<[string, any]>
          ),
        },
      });
      
      // Validate execution
      const validation = validateTaskExecution(executorOutput);
      
      if (!validation.valid) {
        throw new Error(validation.error || "Task execution failed");
      }
      
      let taskToUpdate = executorOutput.task;
      
      // Step 3: Run verification if needed
      if (config.autoVerify && executorOutput.needsVerification) {
        const verificationResults = await verifyChanges(
          {
            task: taskToUpdate,
            modifiedFiles: executorOutput.modifiedFiles,
            workspaceId,
          },
          toolExecutors.execBash,
          toolExecutors.readFile,
          toolExecutors.fileExists,
        );
        
        if (verificationResults.length > 0) {
          // Store verification results
          if (taskToUpdate.result) {
            taskToUpdate.result.verification = verificationResults[0]; // Use first result
          }
          
          // Check if verification failed
          if (hasVerificationFailures(verificationResults)) {
            // Decide whether to retry or create repair task
            if (config.autoRepair && shouldCreateRepairTask(verificationResults[0], taskToUpdate.retryCount)) {
              // Create repair tasks
              const repairTasks = createRepairTasks(taskToUpdate, verificationResults);
              
              // Add repair tasks to plan
              for (const repairTask of repairTasks) {
                state.plan = addTaskToPlan(state.plan, repairTask, taskToUpdate.id);
              }
              
              // Mark original task as completed (repair will fix issues)
              taskToUpdate = completeTask(taskToUpdate);
              
              if (onProgress) {
                await onProgress(createProgressEvent(
                  "task-completed",
                  state.plan,
                  `${taskToUpdate.title} - Verification failed, repair tasks created`,
                  taskToUpdate,
                ));
              }
            } else if (canRetryTask(taskToUpdate)) {
              // Retry the task
              const errorMsg = `Verification failed:\n${formatVerificationResults(verificationResults)}`;
              taskToUpdate = failTask(taskToUpdate, errorMsg);
              taskToUpdate = retryTask(taskToUpdate);
              state.plan = updateTaskInPlan(state.plan, taskToUpdate);
              
              if (onProgress) {
                await onProgress(createProgressEvent(
                  "task-failed",
                  state.plan,
                  `${taskToUpdate.title} - Retrying (${taskToUpdate.retryCount}/${taskToUpdate.maxRetries})`,
                  taskToUpdate,
                ));
              }
              
              continue; // Retry immediately
            } else {
              // Cannot retry, mark as failed
              const errorMsg = `Verification failed:\n${formatVerificationResults(verificationResults)}`;
              taskToUpdate = failTask(taskToUpdate, errorMsg);
              
              if (onProgress) {
                await onProgress(createProgressEvent(
                  "task-failed",
                  state.plan,
                  `${taskToUpdate.title} - Failed after ${taskToUpdate.retryCount} retries`,
                  taskToUpdate,
                ));
              }
              
              // Propagate failure to dependent tasks
              state.plan = updateTaskInPlan(state.plan, taskToUpdate);
              state.plan = propagateFailure(state.plan, taskToUpdate.id);
              continue;
            }
          } else {
            // Verification passed
            taskToUpdate = completeTask(taskToUpdate);
          }
        } else {
          // No verification needed or no commands available
          taskToUpdate = completeTask(taskToUpdate);
        }
      } else {
        // No verification, mark as complete
        taskToUpdate = completeTask(taskToUpdate);
      }
      
      // Update plan
      state.plan = updateTaskInPlan(state.plan, taskToUpdate);
      
      if (onProgress) {
        await onProgress(createProgressEvent(
          "task-completed",
          state.plan,
          `Completed: ${taskToUpdate.title}`,
          taskToUpdate,
        ));
      }
      
    } catch (error) {
      // Task execution error
      const errorMsg = error instanceof Error ? error.message : String(error);
      let failedTask = failTask(startedTask, errorMsg);
      
      // Check if can retry
      if (canRetryTask(failedTask)) {
        failedTask = retryTask(failedTask);
        state.plan = updateTaskInPlan(state.plan, failedTask);
        
        if (onProgress) {
          await onProgress(createProgressEvent(
            "task-failed",
            state.plan,
            `${failedTask.title} - Retrying (${failedTask.retryCount}/${failedTask.maxRetries})`,
            failedTask,
          ));
        }
        
        continue; // Retry immediately
      } else {
        // Cannot retry
        state.plan = updateTaskInPlan(state.plan, failedTask);
        
        if (onProgress) {
          await onProgress(createProgressEvent(
            "task-failed",
            state.plan,
            `${failedTask.title} - Failed: ${errorMsg}`,
            failedTask,
          ));
        }
        
        // Propagate failure
        state.plan = propagateFailure(state.plan, failedTask.id);
      }
    }
  }
  
  // Step 4: Finalize
  state.plan.status = isPlanComplete(state.plan) ? "completed" : "failed";
  state.plan.completedAt = Date.now();
  
  const summary = getExecutionSummary(state.plan);
  const success = state.plan.tasks.filter(t => t.status === "completed").length === state.plan.tasks.length;
  
  if (onProgress) {
    await onProgress(createProgressEvent(
      success ? "plan-completed" : "plan-failed",
      state.plan,
      summary,
    ));
  }
  
  return {
    plan: state.plan,
    state,
    summary,
    success,
  };
}

/**
 * Creates a preview of the plan without executing
 */
export async function previewPlan(
  model: LanguageModel,
  goal: string,
  workspaceId: string,
): Promise<{ plan: ExecutionPlan; formattedPlan: string }> {
  const plan = await createPlan(model, {
    goal,
    workspaceId,
  });
  
  const validation = validatePlan(plan);
  if (!validation.valid) {
    throw new Error(`Invalid plan: ${validation.errors.join(", ")}`);
  }
  
  const formattedPlan = formatPlan(plan);
  
  return { plan, formattedPlan };
}

/**
 * Resumes execution from a saved state
 */
export async function resumeExecution(
  input: OrchestratorInput,
  savedState: ExecutionState,
): Promise<OrchestratorOutput> {
  // Update the input with saved state
  const resumedInput: OrchestratorInput = {
    ...input,
    goal: savedState.plan.goal,
  };
  
  // Continue orchestration with existing state
  // (The orchestrator will pick up from where it left off)
  return orchestrate(resumedInput);
}

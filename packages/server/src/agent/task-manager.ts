/**
 * Task Manager: Orchestrates task execution and manages dependencies
 */

import {
  TaskStatus,
  type ExecutionPlan,
  type ExecutionState,
  type Task,
  type ProgressEvent,
} from "./types";

/**
 * Determines which tasks are ready to execute
 */
export function getExecutableTasks(plan: ExecutionPlan): Task[] {
  const completedTaskIds = new Set(
    plan.tasks.filter(t => t.status === TaskStatus.COMPLETED).map(t => t.id)
  );
  
  const runningTaskIds = new Set(
    plan.tasks.filter(t => t.status === TaskStatus.RUNNING).map(t => t.id)
  );
  
  return plan.tasks.filter(task => {
    // Skip non-pending tasks
    if (task.status !== TaskStatus.PENDING && task.status !== TaskStatus.BLOCKED) {
      return false;
    }
    
    // Check if dependencies are satisfied
    const dependenciesMet = task.dependencies.every(depId => 
      completedTaskIds.has(depId)
    );
    
    if (!dependenciesMet) {
      // Mark as blocked if dependencies aren't met
      if (task.status !== TaskStatus.BLOCKED) {
        task.status = TaskStatus.BLOCKED;
      }
      return false;
    }
    
    // Unblock if was blocked and dependencies are now met
    if (task.status === TaskStatus.BLOCKED) {
      task.status = TaskStatus.PENDING;
    }
    
    return true;
  });
}

/**
 * Gets the next task to execute
 */
export function getNextTask(plan: ExecutionPlan): Task | null {
  const executableTasks = getExecutableTasks(plan);
  
  if (executableTasks.length === 0) {
    return null;
  }
  
  // Return the first executable task (respects original ordering)
  return executableTasks[0];
}

/**
 * Marks a task as started
 */
export function startTask(task: Task): Task {
  return {
    ...task,
    status: TaskStatus.RUNNING,
    startedAt: Date.now(),
  };
}

/**
 * Marks a task as completed
 */
export function completeTask(task: Task): Task {
  return {
    ...task,
    status: TaskStatus.COMPLETED,
    completedAt: Date.now(),
  };
}

/**
 * Marks a task as failed
 */
export function failTask(task: Task, error: string): Task {
  return {
    ...task,
    status: TaskStatus.FAILED,
    completedAt: Date.now(),
    error,
  };
}

/**
 * Retries a failed task
 */
export function retryTask(task: Task): Task {
  if (task.retryCount >= task.maxRetries) {
    return task; // Cannot retry anymore
  }
  
  return {
    ...task,
    status: TaskStatus.PENDING,
    retryCount: task.retryCount + 1,
    error: undefined,
    startedAt: undefined,
    completedAt: undefined,
  };
}

/**
 * Updates a task in the plan
 */
export function updateTaskInPlan(plan: ExecutionPlan, updatedTask: Task): ExecutionPlan {
  return {
    ...plan,
    tasks: plan.tasks.map(t => t.id === updatedTask.id ? updatedTask : t),
  };
}

/**
 * Checks if the plan is complete
 */
export function isPlanComplete(plan: ExecutionPlan): boolean {
  return plan.tasks.every(
    t => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.FAILED
  );
}

/**
 * Checks if the plan has any executable tasks left
 */
export function hasExecutableTasks(plan: ExecutionPlan): boolean {
  return getExecutableTasks(plan).length > 0;
}

/**
 * Gets plan statistics
 */
export function getPlanStats(plan: ExecutionPlan) {
  const total = plan.tasks.length;
  const completed = plan.tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
  const failed = plan.tasks.filter(t => t.status === TaskStatus.FAILED).length;
  const running = plan.tasks.filter(t => t.status === TaskStatus.RUNNING).length;
  const pending = plan.tasks.filter(t => t.status === TaskStatus.PENDING).length;
  const blocked = plan.tasks.filter(t => t.status === TaskStatus.BLOCKED).length;
  
  return {
    total,
    completed,
    failed,
    running,
    pending,
    blocked,
    progress: total > 0 ? (completed / total) * 100 : 0,
    success: failed === 0 && completed === total,
  };
}

/**
 * Formats plan statistics as a string
 */
export function formatPlanStats(plan: ExecutionPlan): string {
  const stats = getPlanStats(plan);
  
  return `Progress: ${stats.completed}/${stats.total} tasks completed (${stats.progress.toFixed(0)}%)
  ✔ Completed: ${stats.completed}
  ✗ Failed: ${stats.failed}
  ⟳ Running: ${stats.running}
  ○ Pending: ${stats.pending}
  ◐ Blocked: ${stats.blocked}`;
}

/**
 * Creates a progress event
 */
export function createProgressEvent(
  type: ProgressEvent["type"],
  plan: ExecutionPlan,
  message: string,
  task?: Task,
): ProgressEvent {
  return {
    type,
    plan,
    task,
    message,
    timestamp: Date.now(),
  };
}

/**
 * Gets dependent tasks (tasks that depend on the given task)
 */
export function getDependentTasks(plan: ExecutionPlan, taskId: string): Task[] {
  return plan.tasks.filter(t => t.dependencies.includes(taskId));
}

/**
 * Checks if a task can be retried
 */
export function canRetryTask(task: Task): boolean {
  return task.status === TaskStatus.FAILED && task.retryCount < task.maxRetries;
}

/**
 * Gets all failed tasks that can be retried
 */
export function getRetryableTasks(plan: ExecutionPlan): Task[] {
  return plan.tasks.filter(canRetryTask);
}

/**
 * Marks all blocked tasks that are waiting on a failed task as failed too
 */
export function propagateFailure(plan: ExecutionPlan, failedTaskId: string): ExecutionPlan {
  const affectedTasks = new Set<string>();
  
  // Find all tasks that transitively depend on the failed task
  function findAffectedTasks(taskId: string) {
    const dependents = getDependentTasks(plan, taskId);
    
    for (const dependent of dependents) {
      if (!affectedTasks.has(dependent.id)) {
        affectedTasks.add(dependent.id);
        findAffectedTasks(dependent.id);
      }
    }
  }
  
  findAffectedTasks(failedTaskId);
  
  // Mark affected tasks as failed if they're blocked
  const updatedTasks = plan.tasks.map(task => {
    if (affectedTasks.has(task.id) && task.status === TaskStatus.BLOCKED) {
      return failTask(task, `Dependency failed: ${failedTaskId}`);
    }
    return task;
  });
  
  return {
    ...plan,
    tasks: updatedTasks,
  };
}

/**
 * Creates an initial execution state
 */
export function createExecutionState(plan: ExecutionPlan): ExecutionState {
  return {
    plan,
    currentTaskIndex: 0,
    toolCallHistory: [],
    paused: false,
  };
}

/**
 * Updates the execution state with a new plan
 */
export function updateExecutionState(
  state: ExecutionState,
  updates: Partial<ExecutionState>,
): ExecutionState {
  return {
    ...state,
    ...updates,
  };
}

/**
 * Determines if execution should continue
 */
export function shouldContinueExecution(state: ExecutionState): boolean {
  if (state.paused) {
    return false;
  }
  
  if (isPlanComplete(state.plan)) {
    return false;
  }
  
  if (!hasExecutableTasks(state.plan)) {
    return false;
  }
  
  return true;
}

/**
 * Gets a summary of the execution
 */
export function getExecutionSummary(plan: ExecutionPlan): string {
  const stats = getPlanStats(plan);
  
  let summary = `# Execution Complete\n\n`;
  summary += `**Goal:** ${plan.goal}\n\n`;
  summary += `## Results\n`;
  summary += `- Total Tasks: ${stats.total}\n`;
  summary += `- Completed: ${stats.completed} ✔\n`;
  summary += `- Failed: ${stats.failed} ✗\n`;
  summary += `- Success Rate: ${stats.progress.toFixed(0)}%\n\n`;
  
  if (stats.failed > 0) {
    summary += `## Failed Tasks\n`;
    plan.tasks
      .filter(t => t.status === TaskStatus.FAILED)
      .forEach(task => {
        summary += `- **${task.title}**: ${task.error || "Unknown error"}\n`;
      });
    summary += `\n`;
  }
  
  if (stats.completed > 0) {
    summary += `## Completed Tasks\n`;
    plan.tasks
      .filter(t => t.status === TaskStatus.COMPLETED)
      .forEach((task, index) => {
        summary += `${index + 1}. ${task.title}\n`;
        if (task.result?.summary) {
          summary += `   ${task.result.summary}\n`;
        }
      });
  }
  
  return summary;
}

/**
 * Adds a new task to the plan (e.g., a repair task)
 */
export function addTaskToPlan(
  plan: ExecutionPlan,
  task: Task,
  insertAfterTaskId?: string,
): ExecutionPlan {
  if (!insertAfterTaskId) {
    // Add to the end
    return {
      ...plan,
      tasks: [...plan.tasks, task],
    };
  }
  
  // Insert after specific task
  const insertIndex = plan.tasks.findIndex(t => t.id === insertAfterTaskId);
  
  if (insertIndex === -1) {
    // Task not found, add to end
    return {
      ...plan,
      tasks: [...plan.tasks, task],
    };
  }
  
  const newTasks = [...plan.tasks];
  newTasks.splice(insertIndex + 1, 0, task);
  
  return {
    ...plan,
    tasks: newTasks,
  };
}

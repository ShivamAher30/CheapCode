/**
 * Test Helpers for Agent System
 * 
 * Utilities for testing the agent system without requiring actual LLM calls
 */

import type { ExecutionPlan, Task, TaskStatus, TaskType, ToolExecutors } from "./types";

/**
 * Creates a mock task for testing
 */
export function createMockTask(overrides?: Partial<Task>): Task {
  return {
    id: `task-${Date.now()}-${Math.random()}`,
    title: "Mock Task",
    description: "A mock task for testing",
    status: "pending" as TaskStatus,
    type: "modify" as TaskType,
    dependencies: [],
    retryCount: 0,
    maxRetries: 3,
    createdAt: Date.now(),
    ...overrides,
  };
}

/**
 * Creates a mock execution plan for testing
 */
export function createMockPlan(taskCount: number = 3): ExecutionPlan {
  const tasks: Task[] = [];
  
  for (let i = 0; i < taskCount; i++) {
    tasks.push(createMockTask({
      id: `task-${i}`,
      title: `Task ${i + 1}`,
      description: `Description for task ${i + 1}`,
      dependencies: i > 0 ? [`task-${i - 1}`] : [], // Each task depends on previous
    }));
  }
  
  return {
    id: `plan-${Date.now()}`,
    goal: "Mock goal for testing",
    tasks,
    status: "pending",
    createdAt: Date.now(),
  };
}

/**
 * Creates mock tool executors for testing
 */
export function createMockToolExecutors(): ToolExecutors {
  const files: Map<string, string> = new Map();
  
  return {
    async readFile(path: string): Promise<string> {
      const content = files.get(path);
      if (!content) {
        throw new Error(`File not found: ${path}`);
      }
      return content;
    },
    
    async fileExists(path: string): Promise<boolean> {
      return files.has(path);
    },
    
    async execBash(cmd: string, timeout?: number): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      // Mock bash execution
      if (cmd.includes("test")) {
        return {
          exitCode: 0,
          stdout: "All tests passed",
          stderr: "",
        };
      }
      
      if (cmd.includes("build")) {
        return {
          exitCode: 0,
          stdout: "Build successful",
          stderr: "",
        };
      }
      
      return {
        exitCode: 0,
        stdout: "",
        stderr: "",
      };
    },
  };
}

/**
 * Simulates a successful task execution
 */
export function simulateSuccessfulTask(task: Task): Task {
  return {
    ...task,
    status: "completed" as TaskStatus,
    completedAt: Date.now(),
    result: {
      success: true,
      summary: `Successfully completed ${task.title}`,
      modifiedFiles: ["file1.ts", "file2.ts"],
    },
  };
}

/**
 * Simulates a failed task execution
 */
export function simulateFailedTask(task: Task, error: string): Task {
  return {
    ...task,
    status: "failed" as TaskStatus,
    completedAt: Date.now(),
    error,
    result: {
      success: false,
      summary: `Failed: ${error}`,
    },
  };
}

/**
 * Validates plan structure
 */
export function validatePlanStructure(plan: ExecutionPlan): boolean {
  if (!plan.id || !plan.goal || !Array.isArray(plan.tasks)) {
    return false;
  }
  
  for (const task of plan.tasks) {
    if (!task.id || !task.title || !task.description) {
      return false;
    }
    
    if (!Array.isArray(task.dependencies)) {
      return false;
    }
  }
  
  return true;
}

/**
 * Checks if a plan has circular dependencies
 */
export function hasCircularDependencies(plan: ExecutionPlan): boolean {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  
  function hasCycle(taskId: string): boolean {
    if (recursionStack.has(taskId)) {
      return true;
    }
    
    if (visited.has(taskId)) {
      return false;
    }
    
    visited.add(taskId);
    recursionStack.add(taskId);
    
    const task = plan.tasks.find(t => t.id === taskId);
    if (task) {
      for (const depId of task.dependencies) {
        if (hasCycle(depId)) {
          return true;
        }
      }
    }
    
    recursionStack.delete(taskId);
    return false;
  }
  
  for (const task of plan.tasks) {
    if (hasCycle(task.id)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Simulates plan execution without actual LLM calls
 */
export async function simulatePlanExecution(
  plan: ExecutionPlan,
  shouldFailTaskIndex?: number,
): Promise<ExecutionPlan> {
  const updatedPlan = { ...plan };
  updatedPlan.status = "running";
  updatedPlan.startedAt = Date.now();
  
  for (let i = 0; i < updatedPlan.tasks.length; i++) {
    const task = updatedPlan.tasks[i];
    
    // Simulate execution delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    if (shouldFailTaskIndex === i) {
      updatedPlan.tasks[i] = simulateFailedTask(task, "Simulated failure");
    } else {
      updatedPlan.tasks[i] = simulateSuccessfulTask(task);
    }
  }
  
  updatedPlan.status = "completed";
  updatedPlan.completedAt = Date.now();
  
  return updatedPlan;
}

/**
 * Logs plan execution for debugging
 */
export function logPlanExecution(plan: ExecutionPlan): void {
  console.log("\n=== Execution Plan ===");
  console.log(`Goal: ${plan.goal}`);
  console.log(`Status: ${plan.status}`);
  console.log(`Tasks: ${plan.tasks.length}\n`);
  
  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i];
    const statusIcon = {
      pending: "○",
      running: "⟳",
      completed: "✔",
      failed: "✗",
      blocked: "◐",
    }[task.status];
    
    console.log(`${statusIcon} ${i + 1}. ${task.title}`);
    console.log(`   Status: ${task.status}`);
    
    if (task.dependencies.length > 0) {
      console.log(`   Dependencies: ${task.dependencies.join(", ")}`);
    }
    
    if (task.error) {
      console.log(`   Error: ${task.error}`);
    }
    
    if (task.result) {
      console.log(`   Result: ${task.result.summary}`);
    }
    
    console.log();
  }
}

/**
 * Counts tasks by status
 */
export function countTasksByStatus(plan: ExecutionPlan): Record<TaskStatus, number> {
  const counts: Record<TaskStatus, number> = {
    pending: 0,
    running: 0,
    completed: 0,
    failed: 0,
    blocked: 0,
  };
  
  for (const task of plan.tasks) {
    counts[task.status]++;
  }
  
  return counts;
}

/**
 * Gets execution metrics
 */
export function getExecutionMetrics(plan: ExecutionPlan) {
  const duration = plan.completedAt && plan.startedAt 
    ? plan.completedAt - plan.startedAt 
    : 0;
  
  const counts = countTasksByStatus(plan);
  const successRate = counts.completed / plan.tasks.length;
  
  return {
    duration,
    totalTasks: plan.tasks.length,
    completedTasks: counts.completed,
    failedTasks: counts.failed,
    successRate,
    averageTaskDuration: duration / plan.tasks.length,
  };
}

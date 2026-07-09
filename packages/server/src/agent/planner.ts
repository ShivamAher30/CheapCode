/**
 * Planner: Decomposes user goals into structured task lists
 */

import { generateObject } from "ai";
import { z } from "zod";
import type { LanguageModel } from "ai";
import {
  type ExecutionPlan,
  type PlannerInput,
  type Task,
  TaskStatus,
  TaskType,
} from "./types";

const taskSchema = z.object({
  title: z.string().describe("Short, clear title for the task"),
  description: z.string().describe("Detailed description of what this task accomplishes"),
  type: z.enum(["analyze", "modify", "verify", "repair"]).describe("Type of task"),
  dependencies: z.array(z.number()).describe("Indices of tasks that must complete before this task (0-indexed)"),
});

const planSchema = z.object({
  reasoning: z.string().describe("Brief explanation of the approach"),
  tasks: z.array(taskSchema).describe("Ordered list of tasks to accomplish the goal"),
});

/**
 * Generates a planning prompt for the LLM
 */
function buildPlanningPrompt(input: PlannerInput): string {
  const { goal, contextFiles, constraints } = input;
  
  let prompt = `You are an expert software engineer creating an execution plan.

## User Goal
${goal}

## Your Task
Break down this goal into a structured list of tasks. Each task should be:
1. **Specific and actionable** - Clear what needs to be done
2. **Appropriately sized** - Not too broad, not too granular
3. **Properly sequenced** - Dependencies reflect actual requirements

## Task Types
- **analyze**: Read and understand code, research, explore codebase
- **modify**: Create/edit/delete files, write code
- **verify**: Run tests, builds, or other validation
- **repair**: Fix issues found during verification

## Guidelines
1. Start with analysis tasks to understand the codebase
2. Group related modifications together
3. Add verification tasks after significant changes
4. Keep the total number of tasks reasonable (5-15 typically)
5. Only add dependencies where truly required - independent tasks can run in parallel`;

  if (contextFiles && contextFiles.length > 0) {
    prompt += `\n\n## Available Context\nThese files are available for reference:\n${contextFiles.map(f => `- ${f}`).join('\n')}`;
  }

  if (constraints?.maxTasks) {
    prompt += `\n\n## Constraints\n- Maximum ${constraints.maxTasks} tasks`;
  }

  prompt += `\n\n## Output Format
Provide:
1. Brief reasoning about your approach
2. A list of tasks with clear titles, descriptions, types, and dependencies

Remember: Good planning leads to successful execution. Think through the logical flow.`;

  return prompt;
}

/**
 * Creates an execution plan from user input
 */
export async function createPlan(
  model: LanguageModel,
  input: PlannerInput,
): Promise<ExecutionPlan> {
  const prompt = buildPlanningPrompt(input);
  
  const result = await generateObject({
    model,
    schema: planSchema,
    prompt,
  });

  const { reasoning, tasks: taskDefinitions } = result.object;
  
  // Convert task definitions to full Task objects
  const tasks: Task[] = taskDefinitions.map((def, index) => {
    const taskId = `task-${Date.now()}-${index}`;
    
    // Convert dependency indices to task IDs
    const dependencies = def.dependencies
      .filter(depIndex => depIndex >= 0 && depIndex < taskDefinitions.length)
      .map(depIndex => `task-${Date.now()}-${depIndex}`);
    
    return {
      id: taskId,
      title: def.title,
      description: def.description,
      status: TaskStatus.PENDING,
      type: def.type as TaskType,
      dependencies,
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    };
  });

  const plan: ExecutionPlan = {
    id: `plan-${Date.now()}`,
    goal: input.goal,
    tasks,
    status: "pending",
    createdAt: Date.now(),
  };

  return plan;
}

/**
 * Validates a plan for logical consistency
 */
export function validatePlan(plan: ExecutionPlan): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  // Check for circular dependencies
  const taskIds = new Set(plan.tasks.map(t => t.id));
  
  for (const task of plan.tasks) {
    // Verify all dependencies exist
    for (const depId of task.dependencies) {
      if (!taskIds.has(depId)) {
        errors.push(`Task "${task.title}" has invalid dependency: ${depId}`);
      }
    }
  }
  
  // Check for circular dependencies using DFS
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
      errors.push(`Circular dependency detected involving task: ${task.title}`);
      break;
    }
  }
  
  // Check for reasonable plan size
  if (plan.tasks.length === 0) {
    errors.push("Plan has no tasks");
  }
  
  if (plan.tasks.length > 50) {
    errors.push("Plan has too many tasks (>50), consider breaking into smaller goals");
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Formats a plan for human-readable display
 */
export function formatPlan(plan: ExecutionPlan): string {
  let output = `# Execution Plan\n\n`;
  output += `**Goal:** ${plan.goal}\n\n`;
  output += `**Tasks:** ${plan.tasks.length}\n\n`;
  
  for (let i = 0; i < plan.tasks.length; i++) {
    const task = plan.tasks[i];
    const statusIcon = {
      [TaskStatus.PENDING]: "○",
      [TaskStatus.RUNNING]: "⟳",
      [TaskStatus.COMPLETED]: "✔",
      [TaskStatus.FAILED]: "✗",
      [TaskStatus.BLOCKED]: "◐",
    }[task.status];
    
    output += `${statusIcon} **${i + 1}. ${task.title}**\n`;
    output += `   ${task.description}\n`;
    
    if (task.dependencies.length > 0) {
      const depNumbers = task.dependencies
        .map(depId => {
          const depIndex = plan.tasks.findIndex(t => t.id === depId);
          return depIndex >= 0 ? depIndex + 1 : "?";
        })
        .join(", ");
      output += `   *Depends on: Task ${depNumbers}*\n`;
    }
    
    output += `\n`;
  }
  
  return output;
}

/**
 * Refines an existing plan based on new information or failures
 */
export async function refinePlan(
  model: LanguageModel,
  plan: ExecutionPlan,
  context: {
    failedTask?: Task;
    newInformation?: string;
    reason: string;
  },
): Promise<ExecutionPlan> {
  const prompt = `You are refining an execution plan based on new information.

## Original Goal
${plan.goal}

## Original Plan
${formatPlan(plan)}

## Reason for Refinement
${context.reason}

${context.failedTask ? `## Failed Task\n**${context.failedTask.title}**\n${context.failedTask.description}\nError: ${context.failedTask.error}\n` : ""}

${context.newInformation ? `## New Information\n${context.newInformation}\n` : ""}

## Your Task
Modify the remaining tasks to address the issue. You can:
1. Add new tasks
2. Modify existing pending/blocked tasks
3. Change task dependencies
4. Remove unnecessary tasks

Do NOT modify completed tasks. Focus on what needs to happen next.`;

  const completedTaskIds = new Set(
    plan.tasks.filter(t => t.status === TaskStatus.COMPLETED).map(t => t.id)
  );
  
  const remainingTasks = plan.tasks.filter(t => !completedTaskIds.has(t.id));
  
  const result = await generateObject({
    model,
    schema: planSchema,
    prompt,
  });

  const { tasks: newTaskDefinitions } = result.object;
  
  // Keep completed tasks and add new tasks
  const completedTasks = plan.tasks.filter(t => completedTaskIds.has(t.id));
  const baseIndex = completedTasks.length;
  
  const newTasks: Task[] = newTaskDefinitions.map((def, index) => {
    const taskId = `task-${Date.now()}-${baseIndex + index}`;
    
    const dependencies = def.dependencies
      .filter(depIndex => depIndex >= 0 && depIndex < newTaskDefinitions.length)
      .map(depIndex => `task-${Date.now()}-${baseIndex + depIndex}`);
    
    return {
      id: taskId,
      title: def.title,
      description: def.description,
      status: TaskStatus.PENDING,
      type: def.type as TaskType,
      dependencies,
      retryCount: 0,
      maxRetries: 3,
      createdAt: Date.now(),
    };
  });

  return {
    ...plan,
    tasks: [...completedTasks, ...newTasks],
  };
}

/**
 * Example: Using the Agent System
 * 
 * This file demonstrates how to use the autonomous agent system
 * for various development tasks.
 */

import { orchestrate, previewPlan } from "./orchestrator";
import type { ProgressEvent } from "./types";

// This is a demonstration file - import your actual model and tools
// import { resolveChatModel } from "../lib/models";
// import { getToolContracts, Mode } from "@localcode/shared";
// import { createToolExecutors } from "../lib/tool-executors";

/**
 * Example 1: Simple Feature Addition
 */
export async function exampleAddFeature() {
  // Uncomment and configure with your actual setup
  /*
  const model = resolveChatModel("llama3.2");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  const result = await orchestrate({
    goal: "Add a health check endpoint to the API that returns server status and uptime",
    workspaceId: "workspace-123",
    model: model.model,
    tools,
    toolExecutors,
    onProgress: (event: ProgressEvent) => {
      console.log(`[${event.type}] ${event.message}`);
      
      if (event.task) {
        console.log(`  Task: ${event.task.title} (${event.task.status})`);
      }
    },
  });
  
  console.log("\n=== Execution Summary ===");
  console.log(result.summary);
  console.log(`Success: ${result.success}`);
  */
}

/**
 * Example 2: Bug Fix
 */
export async function exampleBugFix() {
  /*
  const model = resolveChatModel("llama3.2");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  const result = await orchestrate({
    goal: "Fix the authentication bug where tokens expire incorrectly",
    workspaceId: "workspace-123",
    model: model.model,
    tools,
    toolExecutors,
    config: {
      autoVerify: true,
      autoRepair: true,
      maxRetries: 3,
    },
    onProgress: (event: ProgressEvent) => {
      // Log only important events
      if (event.type === "task-completed" || event.type === "task-failed") {
        console.log(`${event.message}`);
      }
    },
  });
  
  if (!result.success) {
    console.error("Bug fix failed:", result.summary);
  }
  */
}

/**
 * Example 3: Refactoring
 */
export async function exampleRefactoring() {
  /*
  const model = resolveChatModel("deepseek-coder");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  const result = await orchestrate({
    goal: "Refactor the user service to use dependency injection",
    workspaceId: "workspace-123",
    model: model.model,
    tools,
    toolExecutors,
    config: {
      maxTasks: 15,
      autoVerify: true,
      autoRepair: false, // Manual repair for refactoring
    },
  });
  */
}

/**
 * Example 4: Preview Only
 */
export async function examplePreview() {
  /*
  const model = resolveChatModel("llama3.2");
  
  const { plan, formattedPlan } = await previewPlan(
    model.model,
    "Add JWT authentication with refresh tokens",
    "workspace-123"
  );
  
  console.log("=== Execution Plan ===");
  console.log(formattedPlan);
  console.log(`\nTotal Tasks: ${plan.tasks.length}`);
  
  // Review the plan, then execute if satisfied
  // const result = await orchestrate({...});
  */
}

/**
 * Example 5: Custom Configuration
 */
export async function exampleCustomConfig() {
  /*
  const model = resolveChatModel("llama3.2");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  const result = await orchestrate({
    goal: "Migrate from Express to Hono framework",
    workspaceId: "workspace-123",
    model: model.model,
    tools,
    toolExecutors,
    config: {
      maxTasks: 25,        // Complex migration needs more tasks
      maxRetries: 2,       // Fewer retries for migration
      taskTimeout: 600000, // 10 minutes per task
      autoVerify: true,
      autoRepair: true,
    },
    onProgress: async (event: ProgressEvent) => {
      // Could save progress to database
      // await db.progress.create({ data: event });
      
      console.log(`[${new Date().toISOString()}] ${event.message}`);
    },
  });
  */
}

/**
 * Example 6: Handling Failures
 */
export async function exampleErrorHandling() {
  /*
  const model = resolveChatModel("llama3.2");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  try {
    const result = await orchestrate({
      goal: "Add real-time WebSocket support",
      workspaceId: "workspace-123",
      model: model.model,
      tools,
      toolExecutors,
    });
    
    if (result.success) {
      console.log("✓ All tasks completed successfully");
      console.log(result.summary);
    } else {
      console.error("✗ Execution completed with failures");
      
      // Find failed tasks
      const failedTasks = result.plan.tasks.filter(t => t.status === "failed");
      
      for (const task of failedTasks) {
        console.error(`Failed: ${task.title}`);
        console.error(`  Error: ${task.error}`);
        console.error(`  Retries: ${task.retryCount}/${task.maxRetries}`);
      }
      
      // Could implement manual intervention here
    }
  } catch (error) {
    console.error("Fatal error:", error);
  }
  */
}

/**
 * Example 7: Progress Tracking
 */
export async function exampleProgressTracking() {
  /*
  const model = resolveChatModel("llama3.2");
  const tools = getToolContracts(Mode.BUILD);
  const toolExecutors = createToolExecutors("./my-project");
  
  let completedTasks = 0;
  let totalTasks = 0;
  
  const result = await orchestrate({
    goal: "Implement rate limiting middleware",
    workspaceId: "workspace-123",
    model: model.model,
    tools,
    toolExecutors,
    onProgress: (event: ProgressEvent) => {
      if (event.type === "plan-created") {
        totalTasks = event.plan.tasks.length;
        console.log(`Starting execution: ${totalTasks} tasks`);
      }
      
      if (event.type === "task-completed") {
        completedTasks++;
        const progress = Math.round((completedTasks / totalTasks) * 100);
        console.log(`Progress: ${progress}% (${completedTasks}/${totalTasks})`);
      }
      
      if (event.type === "plan-completed") {
        console.log("Execution complete!");
      }
    },
  });
  */
}

/**
 * Example 8: Integration with Existing Code
 */
export async function exampleIntegration() {
  /*
  // In your existing route handler:
  app.post("/api/agent/execute", async (c) => {
    const { goal, workspaceId, model } = await c.req.json();
    
    const resolvedModel = resolveChatModel(model);
    const tools = getToolContracts(Mode.BUILD);
    const toolExecutors = createToolExecutors(workspacePath);
    
    // Stream progress as SSE
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const result = await orchestrate({
          goal,
          workspaceId,
          model: resolvedModel.model,
          tools,
          toolExecutors,
          onProgress: (event) => {
            const data = JSON.stringify(event);
            controller.enqueue(encoder.encode(`data: ${data}\n\n`));
          },
        });
        
        controller.close();
      },
    });
    
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  });
  */
}

/**
 * Main demonstration
 */
async function main() {
  console.log("Agent System Examples");
  console.log("=====================\n");
  console.log("Uncomment the function calls below to run examples:\n");
  
  // await exampleAddFeature();
  // await exampleBugFix();
  // await exampleRefactoring();
  // await examplePreview();
  // await exampleCustomConfig();
  // await exampleErrorHandling();
  // await exampleProgressTracking();
  // await exampleIntegration();
}

// Run if executed directly
if (import.meta.main) {
  main().catch(console.error);
}

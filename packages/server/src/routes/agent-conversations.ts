/**
 * Agent Conversations Route
 * 
 * Implements autonomous agent execution using the orchestrator system.
 * Accepts a goal, creates an execution plan, and returns results.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { getWorkspace } from "./workspaces";
import { resolveChatModel, isSupportedChatModel } from "../lib/models";
import { getToolContracts } from "@localcode/shared";
import { createToolExecutors } from "../lib/tool-executors";
import { orchestrate, previewPlan } from "../agent/orchestrator";

const agentStreamSchema = z.object({
  workspaceId: z.string(),
  goal: z.string().min(1, "Goal is required"),
  model: z.string().refine(isSupportedChatModel, "Unsupported model"),
  groqApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
  preview: z.boolean().optional().default(false),
});

const agentStreamValidator = zValidator("json", agentStreamSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

const app = new Hono()
  .post("/agent/stream", agentStreamValidator, async (c) => {
    const { workspaceId, goal, model, groqApiKey, ollamaBaseUrl, preview } = c.req.valid("json");

    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const resolvedModel = resolveChatModel(model, groqApiKey, ollamaBaseUrl);
    const tools = getToolContracts("BUILD") as any; // Cast to satisfy InferUITools
    const toolExecutors = createToolExecutors(workspace.path);

    // Preview mode: just return the plan without executing
    if (preview) {
      try {
        const { plan, formattedPlan } = await previewPlan(
          resolvedModel.model,
          goal,
          workspaceId,
        );
        return c.json({ plan, formattedPlan });
      } catch (error) {
        return c.json({ 
          error: error instanceof Error ? error.message : "Failed to create plan" 
        }, 500);
      }
    }

    // Full execution mode: run the orchestrator
    try {
      const result = await orchestrate({
        goal,
        workspaceId,
        model: resolvedModel.model,
        tools,
        toolExecutors,
        onProgress: async (event) => {
          console.log(`[Agent] ${event.type}: ${event.message}`);
        },
      });

      return c.json({
        success: result.success,
        summary: result.summary,
        plan: result.plan,
        stats: {
          totalTasks: result.plan.tasks.length,
          completed: result.plan.tasks.filter(t => t.status === "completed").length,
          failed: result.plan.tasks.filter(t => t.status === "failed").length,
        },
      });
    } catch (error) {
      return c.json({ 
        error: error instanceof Error ? error.message : "Agent execution failed" 
      }, 500);
    }
  })
  .get("/agent/status/:id", (c) => {
    // TODO: Implement status tracking for long-running agent tasks
    return c.json({ error: "Agent status tracking not yet implemented" }, 501);
  });

export default app;

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { modeSchema, type SupportedChatModelId } from "@localcode/shared";
import { enrichPrompt } from "../lib/enrichment";
import { getWorkspaceContext } from "../lib/workspace-context";
import { getWorkspace } from "./workspaces";

/**
 * Request schema for enrichment endpoint
 */
const enrichmentRequestSchema = z.object({
  userPrompt: z.string().min(1, "User prompt is required"),
  mode: modeSchema,
  workspaceId: z.string(),
  enrichmentModel: z.string().optional(),
  includeHistory: z.boolean().optional().default(false),
  groqApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
});

const enrichmentValidator = zValidator("json", enrichmentRequestSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body", details: result.error.errors }, 400);
  }
});

/**
 * Enrichment routes
 */
export const enrichmentRoutes = new Hono();

/**
 * POST /api/v1/enrichment/analyze
 * 
 * Analyzes and enriches a user prompt with context and clarifications
 */
enrichmentRoutes.post("/analyze", enrichmentValidator, async (c) => {
  const { userPrompt, mode, workspaceId, enrichmentModel, includeHistory, groqApiKey, ollamaBaseUrl } = c.req.valid("json");

  try {
    // Verify workspace exists
    const workspace = getWorkspace(workspaceId);
    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    // Extract workspace context
    let workspaceContext;
    try {
      workspaceContext = await getWorkspaceContext(workspaceId);
    } catch (error) {
      // Log warning but continue without workspace context
      console.warn(`Failed to extract workspace context: ${error}`);
      workspaceContext = undefined;
    }

    // TODO: Extract conversation history if includeHistory is true
    // For now, we'll pass undefined for conversation history
    const conversationHistory = includeHistory ? undefined : undefined;

    // Call enrichment service
    const result = await enrichPrompt({
      userPrompt,
      mode,
      workspaceContext,
      conversationHistory,
      enrichmentModel: enrichmentModel as SupportedChatModelId | undefined,
      groqApiKey,
      ollamaBaseUrl,
    });

    // Check if enrichment failed (fallback used)
    if ("fallbackUsed" in result) {
      // Log the error but return original prompt
      console.error(`Enrichment failed: ${result.error}`);
      
      return c.json({
        enrichedPrompt: result.originalPrompt,
        wasEnriched: false,
        enrichmentApplied: ["fallback"],
        tokensUsed: 0,
        durationMs: 0,
        error: result.error,
      });
    }

    // Return successful enrichment result
    return c.json({
      enrichedPrompt: result.enrichedPrompt,
      wasEnriched: result.wasEnriched,
      enrichmentApplied: result.enrichmentApplied,
      tokensUsed: result.tokensUsed,
      durationMs: result.durationMs,
      model: result.model,
    });
  } catch (error) {
    console.error("Enrichment endpoint error:", error);
    
    // Return original prompt as fallback
    return c.json({
      enrichedPrompt: userPrompt,
      wasEnriched: false,
      enrichmentApplied: ["error"],
      tokensUsed: 0,
      durationMs: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    }, 500);
  }
});

import { generateText } from "ai";
import type { SupportedChatModelId } from "@localcode/shared";
import type { ModeType } from "@localcode/shared";
import { resolveChatModel } from "./models";
import { validateEnrichedPrompt, maskSecrets } from "./enrichment-validator";
import { buildEnrichmentPrompt, type EnrichmentPromptParams, type ConversationMessage } from "./enrichment-prompts";
import { classifyPromptIntent } from "./enrichment-strategies";
import type { WorkspaceContext } from "./workspace-context.js";

/**
 * Options for enriching a user prompt
 */
export type EnrichmentOptions = {
  /** Original user input to be enriched */
  userPrompt: string;
  /** Current mode (PLAN or BUILD) */
  mode: ModeType;
  /** Workspace context for enrichment (optional) */
  workspaceContext?: WorkspaceContext;
  /** Recent conversation messages for continuity (optional) */
  conversationHistory?: ConversationMessage[];
  /** Model to use for enrichment (optional, defaults to server config) */
  enrichmentModel?: SupportedChatModelId;
  /** Maximum time in milliseconds to wait for enrichment (optional, defaults to 5000) */
  timeoutMs?: number;
  /** Groq API key for BYOK models (optional) */
  groqApiKey?: string;
  /** Ollama base URL for local/remote Ollama models (optional) */
  ollamaBaseUrl?: string;
};

/**
 * Result of a successful enrichment operation
 */
export type EnrichmentResult = {
  /** Enhanced version of the user prompt */
  enrichedPrompt: string;
  /** Whether enrichment was actually applied (false if bypassed) */
  wasEnriched: boolean;
  /** Types of enrichment applied (e.g., ["context", "clarification"]) */
  enrichmentApplied: string[];
  /** Tokens consumed by the enrichment model (optional) */
  tokensUsed?: number;
  /** Time taken for enrichment in milliseconds */
  durationMs: number;
  /** Model used for enrichment (optional) */
  model?: string;
};

/**
 * Error result when enrichment fails
 */
export type EnrichmentError = {
  /** Error message describing what went wrong */
  error: string;
  /** Original user prompt (for fallback) */
  originalPrompt: string;
  /** Always true to indicate fallback was used */
  fallbackUsed: true;
};

/**
 * Default enrichment model (fast and cost-effective Groq model)
 */
const DEFAULT_ENRICHMENT_MODEL: SupportedChatModelId = "llama-3.1-8b-instant";

/**
 * Default timeout for enrichment operations (5 seconds)
 */
const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Maximum prompt length considered "already detailed" (bypasses enrichment)
 */
const DETAILED_PROMPT_THRESHOLD = 300;

/**
 * Enriches a user prompt with context, clarifications, and technical details.
 * 
 * This function analyzes the user's input and expands it with relevant context
 * from the workspace and conversation history. It uses a separate (typically lighter)
 * model for enrichment to balance cost and speed.
 * 
 * Features:
 * - Timeout handling using AbortController
 * - Automatic fallback to original prompt on errors
 * - Bypasses enrichment for already detailed prompts
 * - Tracks metrics (tokens, duration, model used)
 * 
 * @param options - Enrichment configuration including prompt, mode, and context
 * @returns EnrichmentResult with enhanced prompt, or EnrichmentError on failure
 * 
 * @example
 * ```typescript
 * const result = await enrichPrompt({
 *   userPrompt: "add login",
 *   mode: "BUILD",
 *   workspaceContext: { technologies: ["React", "TypeScript"], ... },
 * });
 * 
 * if ("fallbackUsed" in result) {
 *   // Handle error, use original prompt
 *   console.error(result.error);
 * } else {
 *   // Use enriched prompt
 *   console.log(result.enrichedPrompt);
 * }
 * ```
 */
export async function enrichPrompt(
  options: EnrichmentOptions
): Promise<EnrichmentResult | EnrichmentError> {
  const startTime = Date.now();
  const {
    userPrompt,
    mode,
    workspaceContext,
    conversationHistory,
    enrichmentModel = DEFAULT_ENRICHMENT_MODEL,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    groqApiKey,
    ollamaBaseUrl,
  } = options;

  // Bypass enrichment for already detailed prompts
  if (shouldBypassEnrichment(userPrompt)) {
    return {
      enrichedPrompt: userPrompt,
      wasEnriched: false,
      enrichmentApplied: ["bypass_detailed"],
      durationMs: Date.now() - startTime,
      model: enrichmentModel,
    };
  }

  // Set up timeout using AbortController
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    // Resolve the enrichment model
    const resolvedModel = resolveChatModel(enrichmentModel, groqApiKey, ollamaBaseUrl);

    // Classify the prompt intent to get appropriate enrichment strategy
    const intent = classifyPromptIntent(userPrompt, mode);

    // Build the enrichment system prompt using the dedicated module
    const systemPrompt = buildEnrichmentPrompt({
      userPrompt,
      intent,
      mode,
      workspaceContext,
      conversationHistory,
    });

    // Call the enrichment model with timeout
    const result = await generateText({
      model: resolvedModel.model,
      prompt: systemPrompt,
      abortSignal: controller.signal,
    });

    clearTimeout(timeoutId);

    // Extract the enriched prompt from the model's response
    const enrichedPrompt = result.text.trim();

    // Validate the enriched prompt before using it
    // Requirements: 2.5, 7.4, 10.2
    const validationResult = validateEnrichedPrompt(
      userPrompt,
      enrichedPrompt,
      workspaceContext?.recentFiles
    );

    // If validation fails, fall back to original prompt
    if (!validationResult.valid) {
      return {
        error: `Enrichment validation failed: ${validationResult.reason}`,
        originalPrompt: userPrompt,
        fallbackUsed: true,
      };
    }

    // Use the sanitized version if available (with secrets masked)
    const finalEnrichedPrompt = validationResult.sanitizedPrompt || enrichedPrompt;

    // Calculate metrics
    const durationMs = Date.now() - startTime;
    const tokensUsed = result.usage?.totalTokens;

    // Determine enrichment types applied
    const enrichmentApplied = determineEnrichmentTypes(
      userPrompt,
      finalEnrichedPrompt,
      workspaceContext,
      conversationHistory
    );

    return {
      enrichedPrompt: finalEnrichedPrompt,
      wasEnriched: true,
      enrichmentApplied,
      tokensUsed,
      durationMs,
      model: enrichmentModel,
    };
  } catch (error) {
    clearTimeout(timeoutId);

    // Handle timeout errors
    if (error instanceof Error && error.name === "AbortError") {
      return {
        error: "Enrichment timeout",
        originalPrompt: userPrompt,
        fallbackUsed: true,
      };
    }

    // Handle other errors (model unavailable, API errors, etc.)
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return {
      error: `Enrichment failed: ${errorMessage}`,
      originalPrompt: userPrompt,
      fallbackUsed: true,
    };
  }
}

/**
 * Determines if a prompt should bypass enrichment (already detailed enough)
 */
function shouldBypassEnrichment(prompt: string): boolean {
  // Bypass if prompt is already detailed (length > threshold)
  if (prompt.length > DETAILED_PROMPT_THRESHOLD) {
    return true;
  }

  // Could add more sophisticated checks here:
  // - Technical specificity (mentions specific files, functions, etc.)
  // - Presence of acceptance criteria or detailed requirements
  // - Already contains context markers

  return false;
}

/**
 * Builds the system prompt for the enrichment model
 */
function buildEnrichmentSystemPrompt(params: {
  userPrompt: string;
  mode: ModeType;
  workspaceContext?: WorkspaceContext;
  conversationHistory?: ConversationMessage[];
}): string {
  const { userPrompt, mode, workspaceContext, conversationHistory } = params;

  let prompt = `You are a prompt enrichment assistant. Your job is to analyze user prompts and expand them with relevant context, clarifications, and technical details to help an AI coding agent better understand the request.

**User's Original Prompt:**
"${userPrompt}"

**Current Mode:** ${mode}
${mode === "PLAN" ? "- Focus on analysis, exploration, and read-only operations\n- Do NOT suggest file modifications or write operations" : ""}
${mode === "BUILD" ? "- Focus on implementation, modification, and write operations\n- Include suggestions for file operations and code changes" : ""}

`;

  // Add workspace context if available
  if (workspaceContext) {
    prompt += `**Project Context:**
- Technologies: ${workspaceContext.technologies.join(", ") || "Unknown"}
- Project: ${workspaceContext.projectName || "Unknown"}
- Recent Files: ${workspaceContext.recentFiles.slice(0, 5).join(", ") || "None"}
- Structure: ${workspaceContext.fileStructureSummary || "Not available"}

`;
  }

  // Add conversation history if available
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `**Recent Conversation:**
${conversationHistory
  .slice(-5) // Last 5 messages
  .map((msg) => `${msg.role === "user" ? "User" : "Assistant"}: ${msg.content.slice(0, 150)}${msg.content.length > 150 ? "..." : ""}`)
  .join("\n")}

`;
  }

  prompt += `**Your Task:**
1. Analyze the user's prompt for ambiguities, missing context, or unclear intent
2. Expand the prompt with:
   - Relevant technical details based on project context
   - Clarifications of ambiguous terms or references
   - File paths if referenced vaguely (e.g., "the config file")
   - Implementation details appropriate to the current mode
3. Preserve the user's original intent and goals
4. Keep the enriched prompt concise (max 3x the original length)
5. Do NOT add false assumptions or hallucinate features/files

**Output only the enriched prompt text, nothing else.**`;

  return prompt;
}

/**
 * Determines which types of enrichment were applied
 */
function determineEnrichmentTypes(
  originalPrompt: string,
  enrichedPrompt: string,
  workspaceContext?: WorkspaceContext,
  conversationHistory?: ConversationMessage[]
): string[] {
  const types: string[] = [];

  // Check if context was added (mentions of technologies, files, etc.)
  if (workspaceContext && containsWorkspaceReferences(enrichedPrompt, workspaceContext)) {
    types.push("context");
  }

  // Check if prompt was significantly expanded (clarification/details)
  if (enrichedPrompt.length > originalPrompt.length * 1.5) {
    types.push("clarification");
  }

  // Check if technical details were added
  if (containsTechnicalTerms(enrichedPrompt) && !containsTechnicalTerms(originalPrompt)) {
    types.push("technical_details");
  }

  // Check if history influenced enrichment
  if (conversationHistory && conversationHistory.length > 0) {
    types.push("history_aware");
  }

  // Default if nothing specific detected
  if (types.length === 0) {
    types.push("general");
  }

  return types;
}

/**
 * Checks if enriched prompt contains workspace references
 */
function containsWorkspaceReferences(
  prompt: string,
  context: WorkspaceContext
): boolean {
  const lowerPrompt = prompt.toLowerCase();

  // Check for technology mentions
  for (const tech of context.technologies) {
    if (lowerPrompt.includes(tech.toLowerCase())) {
      return true;
    }
  }

  // Check for file mentions
  for (const file of context.recentFiles) {
    if (lowerPrompt.includes(file.toLowerCase())) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if prompt contains technical terms
 */
function containsTechnicalTerms(prompt: string): boolean {
  const technicalKeywords = [
    "function",
    "class",
    "component",
    "module",
    "interface",
    "type",
    "api",
    "endpoint",
    "route",
    "service",
    "handler",
    "schema",
    "validation",
    "authentication",
    "authorization",
  ];

  const lowerPrompt = prompt.toLowerCase();
  return technicalKeywords.some((keyword) => lowerPrompt.includes(keyword));
}

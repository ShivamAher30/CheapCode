/**
 * Enrichment Prompt Builder Module
 * 
 * This module constructs system prompts for the enrichment model based on
 * user prompt intent, mode, workspace context, and conversation history.
 * 
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 6.1, 6.2
 */

import type { ModeType } from "@localcode/shared";
import { Mode } from "@localcode/shared";
import type { PromptIntent } from "./enrichment-strategies";
import type { WorkspaceContext } from "./workspace-context";

/**
 * Conversation message for history context
 */
export type ConversationMessage = {
  /** Role of the message sender */
  role: "user" | "assistant";
  /** Content of the message */
  content: string;
};

/**
 * Parameters for building an enrichment prompt
 */
export type EnrichmentPromptParams = {
  /** The original user prompt to be enriched */
  userPrompt: string;
  /** The classified intent of the prompt */
  intent: PromptIntent;
  /** The current mode (PLAN, BUILD, or AGENT) */
  mode: ModeType;
  /** Optional workspace context for enrichment */
  workspaceContext?: WorkspaceContext;
  /** Optional conversation history for continuity */
  conversationHistory?: ConversationMessage[];
};

/**
 * Build a system prompt for the enrichment model
 * 
 * This function constructs a comprehensive prompt that guides the enrichment model
 * to analyze and expand user prompts appropriately based on intent, mode, and context.
 * 
 * The enrichment prompt includes:
 * - Intent-specific instructions (question, implementation, debug, analysis)
 * - Mode-aware guidance (PLAN vs BUILD focus areas)
 * - Workspace context (technologies, file structure, recent files)
 * - Conversation history for continuity
 * - Quality guidelines (preserve intent, avoid hallucination, concise expansion)
 * 
 * @param params - Parameters including user prompt, intent, mode, and context
 * @returns A complete system prompt string for the enrichment model
 * 
 * @example
 * ```typescript
 * const prompt = buildEnrichmentPrompt({
 *   userPrompt: "add login",
 *   intent: "implementation",
 *   mode: "BUILD",
 *   workspaceContext: { technologies: ["React", "TypeScript"], ... },
 * });
 * ```
 * 
 * Validates: Requirements 1.1, 1.2, 2.1, 2.2, 6.1, 6.2
 */
export function buildEnrichmentPrompt(params: EnrichmentPromptParams): string {
  const { userPrompt, intent, mode, workspaceContext, conversationHistory } = params;

  // Start with the core mission
  let prompt = `You are a prompt enrichment assistant. Your job is to analyze user prompts and expand them with relevant context, clarifications, and technical details to help an AI coding agent better understand the request.

**User's Original Prompt:**
"${userPrompt}"

**Classified Intent:** ${intent}
**Current Mode:** ${mode}

`;

  // Add mode-aware guidance
  prompt += buildModeGuidance(mode);

  // Add workspace context if available
  if (workspaceContext) {
    prompt += buildWorkspaceContextSection(workspaceContext);
  }

  // Add conversation history if available
  if (conversationHistory && conversationHistory.length > 0) {
    prompt += buildConversationHistorySection(conversationHistory);
  }

  // Add intent-specific instructions
  prompt += buildIntentInstructions(intent);

  // Add general guidelines
  prompt += buildGeneralGuidelines(workspaceContext);

  return prompt;
}

/**
 * Build mode-specific guidance for enrichment
 */
function buildModeGuidance(mode: ModeType): string {
  if (mode === Mode.PLAN) {
    return `**Mode Context:**
This is PLAN mode - the user is in analysis and exploration mode.
- Focus on understanding, investigating, and analyzing
- Suggest read-only operations (reading files, searching, listing, inspecting)
- DO NOT suggest file modifications, code changes, or implementation tasks
- If the user's intent requires implementation, suggest switching to BUILD mode
- Expand prompts to help explore and understand the codebase

`;
  } else if (mode === Mode.BUILD) {
    return `**Mode Context:**
This is BUILD mode - the user is ready for implementation and modification.
- Focus on concrete implementation steps and code changes
- Suggest specific file operations (create, modify, delete)
- Include technical requirements and acceptance criteria
- Be specific about what files to create or modify
- Expand prompts to enable clear, actionable implementation

`;
  } else {
    // AGENT mode - balanced approach
    return `**Mode Context:**
This is AGENT mode - the user has access to both analysis and implementation tools.
- Balance exploration and implementation as appropriate for the intent
- Suggest concrete next steps based on the user's goals
- Include both investigative and actionable guidance as needed

`;
  }
}

/**
 * Build workspace context section
 */
function buildWorkspaceContextSection(context: WorkspaceContext): string {
  let section = `**Project Context:**\n`;

  if (context.technologies && context.technologies.length > 0) {
    section += `- Technologies: ${context.technologies.join(", ")}\n`;
  } else {
    section += `- Technologies: Unknown\n`;
  }

  if (context.projectName) {
    section += `- Project: ${context.projectName}\n`;
  }

  if (context.recentFiles && context.recentFiles.length > 0) {
    section += `- Recent Files: ${context.recentFiles.slice(0, 5).join(", ")}\n`;
  }

  if (context.fileStructureSummary) {
    section += `- Structure: ${context.fileStructureSummary}\n`;
  }

  section += "\n";
  return section;
}

/**
 * Build conversation history section
 */
function buildConversationHistorySection(history: ConversationMessage[]): string {
  let section = `**Recent Conversation:**\n`;

  // Include last 5 messages for context, truncated if needed
  const recentMessages = history.slice(-5);
  
  for (const msg of recentMessages) {
    const roleName = msg.role === "user" ? "User" : "Assistant";
    const content = msg.content.length > 150 
      ? msg.content.slice(0, 150) + "..."
      : msg.content;
    section += `${roleName}: ${content}\n`;
  }

  section += "\n";
  return section;
}

/**
 * Build intent-specific instructions
 */
function buildIntentInstructions(intent: PromptIntent): string {
  let instructions = `**Your Task Based on Intent (${intent}):**\n`;

  switch (intent) {
    case "question":
      instructions += `The user is asking a question. Expand the prompt to clarify:
- What specific information would be most helpful
- What context or examples would aid understanding
- What files or components are relevant to the question
- What level of detail is needed (overview vs deep-dive)

Example transformation:
"How does authentication work?" 
→ 
"Explain how authentication works in this codebase. Include: (1) which files handle auth logic, (2) what auth strategy is used (JWT, sessions, OAuth, etc.), (3) how users log in and how tokens/sessions are managed, (4) any relevant middleware or guards."

`;
      break;

    case "implementation":
      instructions += `The user is requesting an implementation. Expand the prompt to include:
- Specific technical requirements and acceptance criteria
- What files should be created or modified
- What patterns or conventions to follow (based on project context)
- What edge cases to consider
- What testing is needed

Example transformation:
"Add a login form"
→
"Create a login form component with: (1) username and password input fields with proper labels, (2) client-side validation (required fields, email format), (3) form submission handler that calls the login API, (4) loading state during submission, (5) error message display for failed login, (6) redirect to dashboard on success. Follow the existing form component patterns in this codebase."

`;
      break;

    case "debug":
      instructions += `The user is reporting a bug or error. Structure the prompt as a debugging task:
- What is the expected behavior
- What is the actual behavior (if provided or can be inferred)
- What files or components are likely involved
- What investigation steps should be taken first
- What logs or error messages to look for

Example transformation:
"Fix the bug in auth.ts"
→
"Debug and fix the issue in auth.ts. Investigation steps: (1) Read auth.ts to understand the implementation, (2) Identify what the bug might be (common issues: token validation, error handling, edge cases), (3) Check related files (API routes, middleware, types), (4) Look for error patterns in logs if available, (5) Fix the root cause, (6) Add tests to prevent regression."

`;
      break;

    case "analysis":
      instructions += `The user is requesting code analysis or review. Expand the prompt to specify:
- What aspects to analyze (architecture, performance, security, patterns)
- What files or components to focus on
- What criteria to evaluate against
- What level of detail in the analysis
- Whether recommendations are needed

Example transformation:
"Review the codebase"
→
"Perform a code analysis focusing on: (1) overall architecture and project structure, (2) identify the main components and their responsibilities, (3) evaluate code organization and modularity, (4) note any potential issues (security, performance, maintainability), (5) highlight good patterns being used, (6) suggest improvements where applicable. Start with the entry point and main modules."

`;
      break;

    case "already_detailed":
      instructions += `The user's prompt is already detailed. Apply minimal enrichment:
- Preserve the existing detail and structure
- Only add clarifications if there are obvious ambiguities
- Do not significantly expand the prompt
- Ensure technical terms are consistent with project context

`;
      break;
  }

  return instructions;
}

/**
 * Build general guidelines section
 */
function buildGeneralGuidelines(workspaceContext?: WorkspaceContext): string {
  let guidelines = `\n**CRITICAL ENRICHMENT RULES - FOLLOW EXACTLY:**

1. **TRANSFORM VAGUE TO SPECIFIC**: Convert brief requests into detailed 10+ step procedures
2. **DEMAND REAL DATA**: The agent MUST use actual workspace files - NO placeholders, templates, or fake content
3. **EXPLICIT TOOL USAGE**: Specify exactly which tools to use (e.g., "Use list_directory('.', depth=3)", "Use read_file('package.json')")
4. **REQUIRE THOROUGHNESS**: Tell the agent to be exhaustive and complete - no shortcuts, no "TODO" sections
5. **ENFORCE ITERATION**: Instruct the agent to review and refine its work until it's professional-quality
6. **BE 5-10x MORE DETAILED**: Your enriched prompt should be significantly longer with step-by-step instructions
7. **PROJECT-SPECIFIC**: Reference actual technologies: ${workspaceContext?.technologies.join(", ") || "from this project"}
8. **NO AMBIGUITY**: Leave NO room for the agent to create minimal/placeholder output
9. **VERIFY QUALITY**: Tell the agent to self-check that the result is comprehensive and useful
10. **PRESERVE INTENT**: Keep the user's core goal but make it exhaustively detailed

**BAD Enrichment Example:**
User: "create summary"
Bad: "Create a summary.md file with project information"  ❌ TOO VAGUE

**GOOD Enrichment Example:**
User: "create summary"
Good: "Create a comprehensive summary.md by following these EXACT steps:
1. Execute list_directory on '.' with depth=3 to map the full project structure
2. Execute read_file on 'package.json' - extract name, description, ALL dependencies, ALL scripts
3. IF README.md exists, execute read_file on it for project context
4. Identify main source directory (src/, packages/, or similar) and list its contents
5. Execute read_file on 3-5 key source files to understand architecture
6. Create summary.md with these sections using REAL data only:
   - Project Name & Description (from actual package.json, not placeholder)
   - Complete Technology Stack (every framework/library found, with versions)
   - Detailed Project Structure (each directory's actual purpose based on its files)
   - Key Features (inferred from analyzing actual source code patterns)
   - Setup & Installation (real commands from package.json scripts)
   - API Documentation (if route files found, document the actual endpoints)
   - Architecture Overview (actual patterns observed: monorepo/single, client/server, etc.)
   - Development Workflow (real npm/bun scripts with descriptions)
7. Review the generated summary - if you find ANY generic text, placeholders, or vague descriptions, STOP and gather more specific information
8. Final check: Would this summary be immediately useful to a new developer? If not, improve it."  ✅ SPECIFIC & ACTIONABLE

**Output:**
Provide ONLY the enriched prompt. Make it so detailed and specific that the agent cannot possibly create placeholder content.`;

  return guidelines;
}

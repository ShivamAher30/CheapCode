/**
 * Enrichment Strategies Module
 * 
 * This module classifies user prompts by intent and determines appropriate
 * enrichment strategies based on intent and mode (PLAN/BUILD/AGENT).
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 9.5
 */

import { type ModeType, Mode } from "@localcode/shared";

/**
 * Prompt intent classifications
 * - question: User is asking for information or explanation
 * - implementation: User is requesting code changes or new features
 * - debug: User is reporting bugs or errors
 * - analysis: User is requesting code analysis or review
 * - already_detailed: Prompt already has sufficient detail (>300 chars with technical specifics)
 */
export type PromptIntent = 
  | "question"
  | "implementation"
  | "debug"
  | "analysis"
  | "already_detailed";

/**
 * Enrichment strategy with instructions for the enrichment model
 */
export type EnrichmentStrategy = {
  intent: PromptIntent;
  shouldEnrich: boolean;
  enrichmentInstructions: string;
};

/**
 * Classify the intent of a user prompt
 * 
 * @param prompt - The original user prompt
 * @param mode - The current mode (BUILD, PLAN, or AGENT)
 * @returns The classified prompt intent
 * 
 * Validates: Requirements 9.5
 */
export function classifyPromptIntent(
  prompt: string,
  mode: ModeType
): PromptIntent {
  const lowerPrompt = prompt.toLowerCase().trim();
  const wordCount = prompt.trim().split(/\s+/).length;
  
  // Check if already detailed (>300 characters with technical specifics)
  // Technical specifics include: file paths, code terms, specific requirements
  if (prompt.length > 300 && wordCount > 50) {
    const hasTechnicalDetails = /\.(ts|js|tsx|jsx|py|java|cpp|c|go|rs|rb|php|cs|swift|kt|dart|html|css|json|yaml|yml|md|sql|sh|bash)|function|class|component|module|import|export|const|let|var|async|await|return|interface|type|enum|package|library|framework|api|endpoint|route|handler|service|repository|controller|model|view|schema|database|query|mutation|subscription|props|state|ref|hook|effect|context|provider|reducer|action|dispatch|selector|middleware|thunk|saga/i.test(prompt);
    
    if (hasTechnicalDetails) {
      return "already_detailed";
    }
  }
  
  // Check for debug/fix intent
  const debugKeywords = [
    "fix", "bug", "error", "issue", "problem", "broken", "not working",
    "doesn't work", "failing", "crash", "exception", "trace", "debug",
    "troubleshoot", "investigate", "incorrect", "wrong"
  ];
  if (debugKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return "debug";
  }
  
  // Check for question intent
  const questionKeywords = [
    "how", "what", "why", "when", "where", "who", "which",
    "explain", "describe", "tell me", "show me", "can you",
    "could you", "would you", "is there", "are there", "does"
  ];
  const isQuestion = lowerPrompt.endsWith("?") || 
                     questionKeywords.some(keyword => lowerPrompt.startsWith(keyword));
  
  if (isQuestion) {
    return "question";
  }
  
  // Check for implementation intent
  const implementationKeywords = [
    "add", "create", "build", "implement", "develop", "write",
    "make", "generate", "setup", "configure", "install", "update",
    "modify", "change", "refactor", "improve", "enhance", "extend",
    "remove", "delete", "replace"
  ];
  if (implementationKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return "implementation";
  }
  
  // Check for analysis intent
  const analysisKeywords = [
    "analyze", "review", "check", "inspect", "examine", "assess",
    "evaluate", "compare", "find", "search", "look for", "identify",
    "list", "show", "display"
  ];
  if (analysisKeywords.some(keyword => lowerPrompt.includes(keyword))) {
    return "analysis";
  }
  
  // Default based on mode
  if (mode === Mode.BUILD) {
    return "implementation";
  } else {
    return "analysis";
  }
}

/**
 * Get the appropriate enrichment strategy based on intent and mode
 * 
 * @param intent - The classified prompt intent
 * @param mode - The current mode (BUILD, PLAN, or AGENT)
 * @returns The enrichment strategy with instructions
 * 
 * Validates: Requirements 9.1, 9.2, 9.3, 9.4, 6.1, 6.2, 6.3
 */
export function getEnrichmentStrategy(
  intent: PromptIntent,
  mode: ModeType
): EnrichmentStrategy {
  // Don't enrich already detailed prompts
  if (intent === "already_detailed") {
    return {
      intent,
      shouldEnrich: false,
      enrichmentInstructions: "",
    };
  }
  
  // Build mode-specific guidance
  let modeGuidance = "";
  if (mode === Mode.PLAN) {
    modeGuidance = `
IMPORTANT: The user is in PLAN mode, which is for analysis and exploration only.
- Focus on understanding, investigating, and analyzing
- Suggest read-only operations (reading files, searching, listing)
- DO NOT suggest file modifications, code changes, or implementation tasks
- If the user's intent requires implementation, suggest switching to BUILD mode`;
  } else if (mode === Mode.BUILD) {
    modeGuidance = `
The user is in BUILD mode, which is for implementation and modification.
- Focus on concrete implementation steps
- Suggest specific file operations and code changes
- Include technical requirements and acceptance criteria
- Be specific about what files to create or modify`;
  } else {
    // AGENT mode - balanced approach
    modeGuidance = `
The user is in AGENT mode with access to both analysis and implementation tools.
- Balance exploration and implementation as appropriate
- Suggest concrete next steps based on the user's intent`;
  }
  
  // Build intent-specific instructions
  let intentInstructions = "";
  
  switch (intent) {
    case "question":
      intentInstructions = `
The user is asking a question. Expand the prompt to clarify:
- What specific information would be most helpful
- What context or examples would aid understanding
- What files or components are relevant to the question
- What level of detail is needed (overview vs deep-dive)

Example enrichment:
"How does authentication work?" → "Explain how authentication works in this codebase. Include: (1) which files handle auth logic, (2) what auth strategy is used (JWT, sessions, OAuth, etc.), (3) how users log in and how tokens/sessions are managed, (4) any relevant middleware or guards."`;
      break;
      
    case "implementation":
      intentInstructions = `
The user is requesting an implementation. Expand the prompt to include:
- **CRITICAL**: Break down the request into explicit, actionable steps
- Specify EXACTLY which files to read, create, or modify
- Include detailed acceptance criteria with measurable outcomes
- List all edge cases that must be handled
- Specify what testing/verification is needed
- **DO NOT create placeholder content** - the agent MUST use real data from the workspace
- **REQUIRE iteration**: The agent should verify results and improve them until they meet quality standards

Example transformations:

"Add a login form" → "Create a complete login form implementation:
1. Create src/components/LoginForm.tsx with: username field (type=email, required, validation), password field (type=password, required, min 8 chars), remember-me checkbox, submit button
2. Implement form validation: client-side validation using schema validation library, display inline error messages, disable submit while invalid
3. Add submission logic: POST to /api/auth/login, handle loading state, handle success (redirect to /dashboard), handle errors (display message)
4. Style consistently with existing components in src/components/*.tsx
5. Add tests: render test, validation test, submission test, error handling test
6. VERIFY: Test the form manually, ensure all edge cases work, check accessibility"

"Create summary.md" → "Create a comprehensive summary.md file for the current project:
1. **SCAN THE DIRECTORY**: Use list_directory tool recursively to understand the full project structure
2. **READ KEY FILES**: Read package.json, README.md (if exists), main source files, configuration files
3. **ANALYZE THE CODEBASE**: Identify the tech stack, dependencies, main features, architecture patterns
4. **CREATE DETAILED CONTENT**: 
   - Project name and description (from package.json or README)
   - Technology stack (frameworks, libraries, tools - actual ones found)
   - Project structure (actual directories and their purposes)
   - Key features (inferred from code analysis)
   - Setup instructions (from package.json scripts)
   - API documentation (if API routes found)
   - Development workflow (available npm scripts)
5. **USE REAL DATA**: Every section must contain actual information from the project, NO placeholders or generic text
6. **ITERATE FOR QUALITY**: After creating the summary, review it - if any section is vague or placeholder-ish, refine it with more specific information
7. **VERIFY COMPLETENESS**: Ensure the summary would be useful to a new developer joining the project"`;
      break;
      
    case "debug":
      intentInstructions = `
The user is reporting a bug or error. Structure the prompt as a debugging task:
- What is the expected behavior
- What is the actual behavior
- What files or components are involved
- What investigation steps should be taken first
- What logs or error messages to look for

Example enrichment:
"Fix the bug in auth.ts" → "Debug and fix the issue in auth.ts. Investigation steps: (1) Read auth.ts to understand the implementation, (2) Identify what the bug might be (common issues: token validation, error handling, edge cases), (3) Check related files (API routes, middleware, types), (4) Look for error patterns in logs if available, (5) Fix the root cause, (6) Add tests to prevent regression."`;
      break;
      
    case "analysis":
      intentInstructions = `
The user is requesting code analysis or review. Expand the prompt to specify:
- What aspects to analyze (architecture, performance, security, patterns)
- What files or components to focus on
- What criteria to evaluate against
- What level of detail in the analysis
- Whether recommendations are needed

Example enrichment:
"Review the codebase" → "Perform a code analysis focusing on: (1) overall architecture and project structure, (2) identify the main components and their responsibilities, (3) evaluate code organization and modularity, (4) note any potential issues (security, performance, maintainability), (5) highlight good patterns being used, (6) suggest improvements where applicable. Start with the entry point and main modules."`;
      break;
  }
  
  return {
    intent,
    shouldEnrich: true,
    enrichmentInstructions: `${modeGuidance}

${intentInstructions}

**CRITICAL General Guidelines**:
1. **BE EXTREMELY SPECIFIC**: Replace vague requests with detailed, step-by-step instructions
2. **REQUIRE REAL DATA**: The agent MUST use actual workspace information, NOT placeholders or templates
3. **DEMAND QUALITY**: The agent should iterate and refine until the result is professional-grade
4. **BREAK DOWN COMPLEXITY**: Convert single requests into multiple concrete steps
5. **SPECIFY TOOLS**: Explicitly tell the agent which tools to use (list_directory, read_file, etc.)
6. **NO SHORTCUTS**: The agent must do thorough work, not create minimal/placeholder content
7. **VERIFY RESULTS**: The agent should review and improve its own output
8. **USE PROJECT CONTEXT**: Reference specific files, technologies, and patterns from THIS codebase
9. **BE EXHAUSTIVE**: Cover all aspects - don't leave gaps or "TODO" sections
10. **PRESERVE USER INTENT**: Keep the core goal but make it comprehensive and actionable

**Output Format**: 
The enriched prompt should be 5-10x more detailed than the original, with explicit step-by-step instructions that leave no room for ambiguity or lazy implementation.`,
  };
}

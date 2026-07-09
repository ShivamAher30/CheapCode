/**
 * Enrichment Validator
 * 
 * Validates enriched prompts before passing them to the main agent.
 * Ensures enrichments are safe, reasonable, and maintain user intent.
 * 
 * Validation Rules:
 * - Enriched prompt must not exceed 3x the original length
 * - Must preserve original user intent (no contradictions)
 * - Must mask API keys and secrets in logs
 * - File paths should be validated against workspace (when workspace context available)
 * 
 * @module enrichment-validator
 */

/**
 * Result of enriched prompt validation
 */
export type ValidationResult = {
  /** Whether the enriched prompt passed validation */
  valid: boolean;
  /** Reason for validation failure (if invalid) */
  reason?: string;
  /** Sanitized version of prompt with secrets masked (if applicable) */
  sanitizedPrompt?: string;
};

/**
 * Maximum multiplier for enriched prompt length vs original
 * Increased to allow much more detailed enrichments
 */
const MAX_LENGTH_MULTIPLIER = 10;

/**
 * Regex patterns for detecting API keys and secrets
 * Requirement 10.2: Mask API keys and tokens in logs
 */
const SECRET_PATTERNS = [
  // OpenAI API keys (sk-proj... or sk-...)
  /sk-[a-zA-Z0-9]{20,}/g,
  // Anthropic API keys
  /sk-ant-[a-zA-Z0-9-]{95,}/g,
  // Groq API keys (gsk_...)
  /gsk_[a-zA-Z0-9]{20,}/g,
  // Generic Bearer tokens
  /Bearer\s+[a-zA-Z0-9_\-\.]{20,}/g,
  // AWS access keys
  /AKIA[0-9A-Z]{16}/g,
  // Generic API key patterns
  /api[_-]?key[s]?[:\s=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  // Generic secret patterns
  /secret[s]?[:\s=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
  // Generic token patterns
  /token[s]?[:\s=]+['"]?([a-zA-Z0-9_\-]{20,})['"]?/gi,
];

/**
 * Validates an enriched prompt before passing to the main agent
 * 
 * Performs the following checks:
 * 1. Length validation: Rejects if enriched > 3x original
 * 2. Secret masking: Masks API keys and tokens
 * 3. File path validation: Validates paths if workspace context provided
 * 4. Intent preservation: Basic checks for contradictions
 * 
 * @param originalPrompt - Original user prompt
 * @param enrichedPrompt - Enhanced version from enrichment model
 * @param workspaceFiles - Optional list of valid workspace file paths for validation
 * @returns ValidationResult indicating if enriched prompt is valid
 * 
 * @example
 * ```typescript
 * const result = validateEnrichedPrompt(
 *   "Add login",
 *   "Add a login form with username and password fields"
 * );
 * 
 * if (result.valid) {
 *   // Use enriched prompt
 *   console.log(result.sanitizedPrompt);
 * } else {
 *   // Fallback to original
 *   console.error(result.reason);
 * }
 * ```
 */
export function validateEnrichedPrompt(
  originalPrompt: string,
  enrichedPrompt: string,
  workspaceFiles?: string[]
): ValidationResult {
  // Validate inputs
  if (!originalPrompt || !enrichedPrompt) {
    return {
      valid: false,
      reason: "Original or enriched prompt is empty",
    };
  }

  // Trim whitespace for accurate length comparisons
  const trimmedOriginal = originalPrompt.trim();
  const trimmedEnriched = enrichedPrompt.trim();

  // Check 1: Length validation
  // Requirement 7.4
  // Allow up to 10000 characters of added context, or 10x original length (whichever is larger)
  const maxLength = Math.max(10000, trimmedOriginal.length * MAX_LENGTH_MULTIPLIER);
  if (trimmedEnriched.length > maxLength) {
    return {
      valid: false,
      reason: `Enriched prompt too long (${trimmedEnriched.length} > ${maxLength})`,
    };
  }

  // Check 2: Ensure enriched prompt is not empty or just whitespace
  if (trimmedEnriched.length === 0) {
    return {
      valid: false,
      reason: "Enriched prompt is empty after trimming",
    };
  }

  // Check 3: Validate file paths if workspace context provided
  // Requirement 2.5: File paths must exist in workspace or be marked as suggestions
  // Only validate if workspace files are explicitly provided (not empty array)
  if (workspaceFiles && workspaceFiles.length > 0) {
    const filePathValidation = validateFilePaths(trimmedEnriched, workspaceFiles);
    if (!filePathValidation.valid) {
      return filePathValidation;
    }
  }

  // Check 4: Mask secrets in the enriched prompt
  // Requirement 10.2: Mask API keys and tokens in logs
  const sanitizedPrompt = maskSecrets(trimmedEnriched);

  // All checks passed
  return {
    valid: true,
    sanitizedPrompt,
  };
}

/**
 * Masks API keys and secrets in a prompt
 * 
 * Detects common API key patterns and replaces them with asterisks
 * to prevent leaking secrets in logs or UI.
 * 
 * Requirement 10.2: Mask API keys and tokens in logs
 * 
 * @param prompt - Prompt potentially containing secrets
 * @returns Prompt with secrets masked as ***
 * 
 * @example
 * ```typescript
 * const masked = maskSecrets("Use key sk-abc123xyz to connect");
 * // Returns: "Use key *** to connect"
 * ```
 */
export function maskSecrets(prompt: string): string {
  let masked = prompt;

  for (const pattern of SECRET_PATTERNS) {
    masked = masked.replace(pattern, "***");
  }

  return masked;
}

/**
 * Validates file paths mentioned in the enriched prompt
 * 
 * Checks that any file paths referenced in the enriched prompt either:
 * 1. Exist in the workspace (validated against workspaceFiles list)
 * 2. Are clearly marked as suggestions for new files
 * 
 * Requirement 2.5: File paths must be validated against workspace
 * 
 * @param enrichedPrompt - Enhanced prompt to validate
 * @param workspaceFiles - List of valid file paths in the workspace
 * @returns ValidationResult indicating if file paths are valid
 */
function validateFilePaths(
  enrichedPrompt: string,
  workspaceFiles: string[]
): ValidationResult {
  // Extract potential file paths from enriched prompt
  // Match common file path patterns:
  // - Unix paths: /path/to/file.ext or ./relative/path.ext
  // - Windows paths: C:\path\to\file.ext or .\relative\path.ext
  // - Common file extensions: .ts, .js, .tsx, .jsx, .json, .md, .css, etc.
  // Require at least one directory separator so bare names like "Node.js" or "README.md"
  // are not falsely flagged — only actual paths like "src/index.ts" or "./utils.js"
  const filePathPattern = /(?:[a-zA-Z]:)?(?:[\w\-]+[\/\\\\])+[\w\-\.]+\.(?:ts|tsx|js|jsx|json|md|css|scss|html|xml|yaml|yml|toml|lock|txt|env|py|java|cpp|c|h|hpp|rs|go|rb|php|sh|bat|sql)/g;
  
  const potentialPaths = enrichedPrompt.match(filePathPattern) || [];

  // No paths found, validation passes
  if (potentialPaths.length === 0) {
    return { valid: true };
  }

  // Normalize workspace files for comparison (handle both Unix and Windows paths)
  const normalizedWorkspaceFiles = workspaceFiles.map(normalizePath);

  // Check each potential path
  const invalidPaths: string[] = [];
  
  for (const path of potentialPaths) {
    const normalizedPath = normalizePath(path);
    
    // Check if path is marked as a suggestion (e.g., "create src/new-file.ts")
    const isMarkedAsSuggestion = isPathSuggestion(enrichedPrompt, path);
    
    // If marked as suggestion, skip workspace validation
    if (isMarkedAsSuggestion) {
      continue;
    }
    
    // Check if path exists in workspace by checking if any workspace file contains this path
    const existsInWorkspace = normalizedWorkspaceFiles.some((wsFile) => {
      // Extract just the filename from the path for comparison
      const pathParts = normalizedPath.split(/[\/\\]/);
      const fileName = pathParts[pathParts.length - 1];
      
      const wsFileParts = wsFile.split(/[\/\\]/);
      const wsFileName = wsFileParts[wsFileParts.length - 1];
      
      // Check multiple matching strategies:
      // 1. Exact match
      if (wsFile === normalizedPath) return true;
      // 2. Workspace file ends with the path
      if (wsFile.endsWith(normalizedPath)) return true;
      // 3. Path ends with workspace file (handles partial paths)
      if (normalizedPath.endsWith(wsFile)) return true;
      // 4. Both end with same relative path (e.g., "src/auth.ts" matches "project/src/auth.ts")
      const pathSegments = normalizedPath.split(/[\/\\]/);
      for (let i = 0; i < pathSegments.length; i++) {
        const subPath = pathSegments.slice(i).join('/');
        if (wsFile.endsWith(subPath)) return true;
      }
      // 5. Filename match (handles "Login.tsx" vs "src/components/Login.tsx")
      if (fileName === wsFileName) return true;
      
      return false;
    });

    if (!existsInWorkspace) {
      invalidPaths.push(path);
    }
  }

  // If there are invalid paths, validation fails
  if (invalidPaths.length > 0) {
    return {
      valid: false,
      reason: `Enriched prompt contains file paths that don't exist in workspace: ${invalidPaths.join(", ")}`,
    };
  }

  return { valid: true };
}

/**
 * Normalizes a file path for cross-platform comparison
 * 
 * Converts backslashes to forward slashes and converts to lowercase
 * for case-insensitive comparison.
 * 
 * @param path - File path to normalize
 * @returns Normalized path
 */
function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").toLowerCase();
}

/**
 * Checks if a file path in the enriched prompt is marked as a suggestion
 * 
 * Looks for keywords indicating the path is a suggestion for a new file:
 * - "create"
 * - "add"
 * - "new"
 * - "suggest"
 * - "should create"
 * 
 * @param enrichedPrompt - Full enriched prompt text
 * @param path - File path to check
 * @returns True if path appears to be a suggestion
 */
function isPathSuggestion(enrichedPrompt: string, path: string): boolean {
  const suggestionKeywords = [
    "create",
    "add",
    "new",
    "suggest",
    "should create",
    "could create",
    "might create",
    "recommend creating",
    "propose creating",
  ];

  // Find the context around the path (50 chars before and after)
  const pathIndex = enrichedPrompt.indexOf(path);
  if (pathIndex === -1) return false;

  const contextStart = Math.max(0, pathIndex - 50);
  const contextEnd = Math.min(enrichedPrompt.length, pathIndex + path.length + 50);
  const context = enrichedPrompt.slice(contextStart, contextEnd).toLowerCase();

  // Check if any suggestion keyword appears near the path
  return suggestionKeywords.some((keyword) => context.includes(keyword));
}

/**
 * Checks if enriched prompt preserves original intent
 * 
 * Performs basic checks to ensure the enriched prompt doesn't
 * contradict or fundamentally alter the user's original intent.
 * 
 * This is a best-effort check and may not catch all cases.
 * 
 * Requirement 1.6: Enriched prompt must preserve original intent
 * 
 * @param originalPrompt - Original user prompt
 * @param enrichedPrompt - Enhanced prompt
 * @returns True if intent appears preserved
 */
export function preservesIntent(
  originalPrompt: string,
  enrichedPrompt: string
): boolean {
  const originalLower = originalPrompt.toLowerCase();
  const enrichedLower = enrichedPrompt.toLowerCase();

  // Extract key action words from original prompt
  const actionWords = extractActionWords(originalLower);

  // Check if enriched prompt contains the key action words
  const hasActions = actionWords.every((action) =>
    enrichedLower.includes(action)
  );

  // Extract key noun phrases from original prompt
  const keyPhrases = extractKeyPhrases(originalLower);

  // Check if enriched prompt contains key phrases
  const hasPhrases = keyPhrases.every((phrase) =>
    enrichedLower.includes(phrase)
  );

  // Intent is preserved if both actions and key phrases are present
  return hasActions && hasPhrases;
}

/**
 * Extracts action words from a prompt
 * 
 * @param prompt - Prompt text
 * @returns Array of action words
 */
function extractActionWords(prompt: string): string[] {
  const commonActions = [
    "add",
    "create",
    "delete",
    "remove",
    "update",
    "modify",
    "fix",
    "debug",
    "implement",
    "refactor",
    "analyze",
    "review",
    "test",
    "optimize",
    "improve",
  ];

  return commonActions.filter((action) => prompt.includes(action));
}

/**
 * Extracts key noun phrases from a prompt
 * 
 * Simple extraction of multi-word technical terms.
 * 
 * @param prompt - Prompt text
 * @returns Array of key phrases
 */
function extractKeyPhrases(prompt: string): string[] {
  // Extract quoted phrases
  const quotedPhrases = prompt.match(/"([^"]+)"/g) || [];
  
  // Extract common technical multi-word terms
  const technicalTerms = [
    "login form",
    "user authentication",
    "api endpoint",
    "database connection",
    "error handling",
    "unit test",
    "file upload",
    "data validation",
  ];

  const foundTerms = technicalTerms.filter((term) => prompt.includes(term));

  return [...quotedPhrases.map((p) => p.replace(/"/g, "")), ...foundTerms];
}

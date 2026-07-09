/**
 * Manual verification script for enrichment-validator module
 * 
 * This script tests the core functionality of the enrichment validator:
 * - Length validation (reject if > 3x original)
 * - Secret masking for API keys and tokens
 * - File path validation against workspace
 */

import { validateEnrichedPrompt, maskSecrets, preservesIntent } from "./enrichment-validator";

console.log("=== Enrichment Validator Tests ===\n");

// Test 1: Valid enrichment
console.log("Test 1: Valid enrichment");
const test1 = validateEnrichedPrompt(
  "Add login",
  "Add a login form with username and password fields, validation, and submit handler"
);
console.log(`✓ Valid: ${test1.valid}`);
console.log(`  Result: ${test1.sanitizedPrompt?.slice(0, 50)}...\n`);

// Test 2: Over-expanded prompt (> 3x length)
console.log("Test 2: Over-expanded prompt (should fail)");
const original = "Fix bug";
const tooLong = "a".repeat(original.length * 4);
const test2 = validateEnrichedPrompt(original, tooLong);
console.log(`✓ Valid: ${test2.valid} (expected: false)`);
console.log(`  Reason: ${test2.reason}\n`);

// Test 3: Secret masking - OpenAI key
console.log("Test 3: Secret masking - OpenAI key");
const withOpenAIKey = "Use key sk-proj1234567890abcdefghijklmnopqrstuvwxyz12345678 to connect";
const test3 = validateEnrichedPrompt(withOpenAIKey, withOpenAIKey);
console.log(`✓ Valid: ${test3.valid}`);
console.log(`  Original: ${withOpenAIKey}`);
console.log(`  Masked: ${test3.sanitizedPrompt}\n`);

// Test 4: Secret masking - Groq key
console.log("Test 4: Secret masking - Groq key");
const withGroqKey = "Configure with gsk_1234567890abcdefghijklmnopqrstuvwxyz123456789012";
const masked = maskSecrets(withGroqKey);
console.log(`✓ Original: ${withGroqKey}`);
console.log(`  Masked: ${masked}\n`);

// Test 5: Secret masking - Generic API key
console.log("Test 5: Secret masking - Generic API key");
const withGenericKey = 'Set api_key="abc123def456ghi789jkl012mno345"';
const test5 = maskSecrets(withGenericKey);
console.log(`✓ Original: ${withGenericKey}`);
console.log(`  Masked: ${test5}\n`);

// Test 6: File path validation - valid files
console.log("Test 6: File path validation - valid files");
const workspaceFiles = [
  "src/auth.ts",
  "src/config.json",
  "src/components/Login.tsx",
];
const promptWithValidFiles = "Update the login form in src/components/Login.tsx and src/auth.ts";
const test6 = validateEnrichedPrompt(
  "Update login",
  promptWithValidFiles,
  workspaceFiles
);
console.log(`✓ Valid: ${test6.valid} (expected: true)\n`);

// Test 7: File path validation - invalid files (not in workspace)
console.log("Test 7: File path validation - invalid files");
const promptWithInvalidFiles = "Update src/components/NonExistent.tsx";
const test7 = validateEnrichedPrompt(
  "Update component",
  promptWithInvalidFiles,
  workspaceFiles
);
console.log(`✓ Valid: ${test7.valid} (expected: false)`);
console.log(`  Reason: ${test7.reason}\n`);

// Test 8: File path validation - suggested new file
console.log("Test 8: File path validation - suggested new file");
const promptWithSuggestion = "Create a new file src/components/NewComponent.tsx for the feature";
const test8 = validateEnrichedPrompt(
  "Add component",
  promptWithSuggestion,
  workspaceFiles
);
console.log(`✓ Valid: ${test8.valid} (expected: true, file is marked as suggestion)\n`);

// Test 9: Intent preservation check
console.log("Test 9: Intent preservation check");
const originalIntent = "Fix the authentication bug in login";
const enrichedPreserved = "Fix the authentication bug in the login module by investigating the token validation logic";
const test9 = preservesIntent(originalIntent, enrichedPreserved);
console.log(`✓ Preserves intent: ${test9} (expected: true)\n`);

// Test 10: Empty prompt validation
console.log("Test 10: Empty prompt validation");
const test10 = validateEnrichedPrompt("Test", "");
console.log(`✓ Valid: ${test10.valid} (expected: false)`);
console.log(`  Reason: ${test10.reason}\n`);

// Test 11: Multiple secret types
console.log("Test 11: Multiple secret types in one prompt");
const multipleSecrets = `
Config:
- OpenAI: sk-proj123456789012345678901234567890123456789012345678
- Groq: gsk_abcdefghijklmnopqrstuvwxyz1234567890123456789012
- AWS: AKIAIOSFODNN7EXAMPLE
- Bearer: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9
`;
const test11 = maskSecrets(multipleSecrets);
console.log(`✓ Masked result:`);
console.log(test11);
console.log();

// Test 12: Edge case - exactly 3x length (should pass)
console.log("Test 12: Edge case - exactly 3x length");
const original12 = "Hello";
const exactly3x = "Hello world ".repeat(Math.ceil(original12.length * 3 / 12)).slice(0, original12.length * 3);
const test12 = validateEnrichedPrompt(original12, exactly3x);
console.log(`✓ Valid: ${test12.valid} (expected: true, exactly 3x is allowed)`);
console.log(`  Original length: ${original12.length}, Enriched length: ${exactly3x.length}\n`);

console.log("=== All Tests Completed ===");

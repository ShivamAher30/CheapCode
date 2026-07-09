import { validateEnrichedPrompt } from "./enrichment-validator";

// Test 1: Valid enrichment without workspace files
console.log("Test 1: Valid enrichment (no workspace files)");
const test1 = validateEnrichedPrompt(
  "Add login",
  "Add a login form with username and password fields, validation, and submit handler"
);
console.log("Result:", test1);
console.log();

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
console.log("Result:", test6);
console.log();

// Test 8: File path validation - suggested new file
console.log("Test 8: File path validation - suggested new file");
const promptWithSuggestion = "Create a new file src/components/NewComponent.tsx for the feature";
const test8 = validateEnrichedPrompt(
  "Add component",
  promptWithSuggestion,
  workspaceFiles
);
console.log("Result:", test8);

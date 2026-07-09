import { validateEnrichedPrompt } from "./enrichment-validator";

console.log("=== Debug Test 1 ===");
const test1 = validateEnrichedPrompt(
  "Add login",
  "Add a login form with username and password fields, validation, and submit handler"
);
console.log("Result:", JSON.stringify(test1, null, 2));

console.log("\n=== Debug Test 6 ===");
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
console.log("Result:", JSON.stringify(test6, null, 2));

// Test the file pattern matching
console.log("\n=== Test pattern matching ===");
const pattern = /(?:\.?\.?[\/\\])?(?:[a-zA-Z]:)?[\w\-\/\\\.]+\.(?:ts|tsx|js|jsx|json|md|css|scss|html|xml|yaml|yml|toml|lock|txt|env|gitignore|py|java|cpp|c|h|hpp|rs|go|rb|php|sh|bat|sql)/g;
const matches = promptWithValidFiles.match(pattern);
console.log("Paths found:", matches);

console.log("\n=== Test 8 Debug ===");
const promptWithSuggestion = "Create a new file src/components/NewComponent.tsx for the feature";
const test8 = validateEnrichedPrompt(
  "Add component",
  promptWithSuggestion,
  workspaceFiles
);
console.log("Result:", JSON.stringify(test8, null, 2));
const matches8 = promptWithSuggestion.match(pattern);
console.log("Paths found:", matches8);

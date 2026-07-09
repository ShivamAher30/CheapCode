import { z } from "zod";
import { tool } from "ai";

export const Mode = {
  BUILD: "BUILD",
  PLAN: "PLAN",
  AGENT: "AGENT",
} as const;

export const modeSchema = z.enum([Mode.BUILD, Mode.PLAN, Mode.AGENT]);

export type ModeType = (typeof Mode)[keyof typeof Mode];

export const toolInputSchemas = {
  readFile: z.object({
    path: z.string().describe("Relative path to the file to read (e.g. 'src/index.ts', 'package.json')"),
  }),
  listDirectory: z.object({
    path: z.string().default(".").describe("Relative directory path to list (e.g. '.', 'src', 'packages/cli')"),
  }),
  glob: z.object({
    pattern: z.string().describe("Glob pattern to match files (e.g. '**/*.ts', 'src/**/*.tsx', '**/package.json')"),
    path: z.string().default(".").describe("Directory to search from (e.g. '.', 'packages')"),
  }),
  grep: z.object({
    pattern: z.string().describe("Regex pattern to search for in file contents (e.g. 'export function', 'import.*react')"),
    path: z.string().default(".").describe("Directory to search from"),
    include: z.string().optional().describe("Optional glob for files to include (e.g. '*.ts', '*.tsx')"),
  }),
  writeFile: z.object({
    path: z.string().describe("Relative path to write the file to (e.g. 'README.md', 'src/utils.ts')"),
    content: z.string().describe("Complete file contents to write. Must be the full file content, not a partial update."),
  }),
  editFile: z.object({
    path: z.string().describe("Relative path to the file to edit"),
    oldString: z.string().describe("Exact text to replace. Must be a unique substring within the file. Include enough surrounding context to ensure uniqueness."),
    newString: z.string().describe("Replacement text that will replace the oldString"),
  }),
  bash: z.object({
    command: z.string().describe("Shell command to run (e.g. 'npm test', 'cat file.txt', 'ls -la')"),
    description: z.string().optional().describe("Short description of what this command does"),
    timeout: z.number().optional().describe("Timeout in milliseconds (default: 60000)"),
  }),
} as const;

export const readOnlyToolContracts = {
  readFile: tool({
    description: "Read the full contents of a file from the project directory. Use this to understand existing code, configuration, and documentation before making any changes. Returns the file content as text.",
    inputSchema: toolInputSchemas.readFile,
  }),
  listDirectory: tool({
    description: "List all files and directories in a given directory. Returns name and type (file/directory) for each entry. Use this first to understand the project structure. Excludes hidden files and node_modules.",
    inputSchema: toolInputSchemas.listDirectory,
  }),
  glob: tool({
    description: "Find files matching a glob pattern anywhere in the project. Use patterns like '**/*.ts' for all TypeScript files, '**/package.json' for all package files, or 'src/**/*.test.ts' for test files. Returns a list of matching file paths.",
    inputSchema: toolInputSchemas.glob,
  }),
  grep: tool({
    description: "Search file contents using a regex pattern. Returns matching lines with file paths and line numbers. Use this to find function definitions, imports, usages, or any text patterns across the codebase.",
    inputSchema: toolInputSchemas.grep,
  }),
} as const;

export const buildToolContracts = {
  ...readOnlyToolContracts,
  writeFile: tool({
    description: "Create a new file or completely overwrite an existing file. Use this for creating new files or when most of a file needs to change. For small targeted edits to existing files, prefer editFile instead. The content should be the COMPLETE file content.",
    inputSchema: toolInputSchemas.writeFile,
  }),
  editFile: tool({
    description: "Make a precise text replacement in an existing file. The oldString must exactly match a unique substring in the file. Use this for small, targeted changes like fixing a bug, updating a value, or modifying a function. Always read the file first to get the exact text.",
    inputSchema: toolInputSchemas.editFile,
  }),
  bash: tool({
    description: "Run a shell command in the project directory. Use for running tests (npm test), builds (npm run build), installing packages (npm install), checking git status, or any other CLI operations. Returns stdout, stderr, and exit code.",
    inputSchema: toolInputSchemas.bash,
  }),
} as const;

export type ToolContracts = typeof buildToolContracts;

export function getToolContracts(mode: ModeType) {
  return mode === Mode.PLAN 
    ? readOnlyToolContracts 
    : buildToolContracts;
};

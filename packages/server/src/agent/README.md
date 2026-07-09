# Autonomous Agent System

This module implements an explicit planning layer for autonomous code execution, transforming the simple tool-calling assistant into a sophisticated multi-step agent similar to Claude Code.

## Architecture Overview

### Flow Comparison

**Before (Direct Tool Calling):**
```
User Prompt → LLM → Tool Call → Tool Result → LLM → Tool Call → ... → Response
```

**After (Explicit Planning):**
```
User Goal
    ↓
Planner (LLM decomposes goal)
    ↓
Task List (structured, with dependencies)
    ↓
Task Manager (orchestrates execution)
    ↓
Executor (executes one task with multiple tool calls)
    ↓
Verification (automatic build/test)
    ↓
Repair (if verification fails)
    ↓
Progress Updates (streaming to UI)
    ↓
Next Task (until all complete)
    ↓
Final Summary
```

## Core Modules

### 1. Planner (`planner.ts`)

**Purpose:** Decomposes user goals into structured, executable tasks.

**Key Functions:**
- `createPlan(model, input)` - Generates an execution plan from a user goal
- `validatePlan(plan)` - Validates plan for logical consistency
- `formatPlan(plan)` - Formats plan for human-readable display
- `refinePlan(model, plan, context)` - Refines a plan based on new information

**Task Structure:**
```typescript
{
  id: string;              // Unique identifier
  title: string;           // Short, clear title
  description: string;     // Detailed description
  status: TaskStatus;      // pending/running/completed/failed/blocked
  type: TaskType;          // analyze/modify/verify/repair
  dependencies: string[];  // IDs of prerequisite tasks
  retryCount: number;      // Current retry count
  maxRetries: number;      // Maximum allowed retries
}
```

**Task Types:**
- `analyze` - Read and understand code
- `modify` - Create/edit/delete files
- `verify` - Run tests or builds
- `repair` - Fix verification failures

### 2. Task Manager (`task-manager.ts`)

**Purpose:** Orchestrates task execution and manages dependencies.

**Key Functions:**
- `getNextTask(plan)` - Determines which task to execute next
- `getExecutableTasks(plan)` - Returns all tasks ready to run
- `updateTaskInPlan(plan, task)` - Updates a task in the plan
- `isPlanComplete(plan)` - Checks if all tasks are done
- `propagateFailure(plan, taskId)` - Marks dependent tasks as failed

**Dependency Management:**
- Tracks task dependencies using task IDs
- Blocks tasks until dependencies complete
- Propagates failures to dependent tasks
- Supports parallel execution of independent tasks

### 3. Executor (`executor.ts`)

**Purpose:** Executes individual tasks using LLM and tools.

**Key Functions:**
- `executeTask(model, tools, input)` - Executes a single task
- `validateTaskExecution(output)` - Validates task completed successfully
- `formatTaskResult(task)` - Formats task result for display

**Execution Flow:**
1. Build task-specific prompt with context
2. Call LLM with tools (allows multiple tool calls via `maxSteps`)
3. Track tool calls and modified files
4. Determine if verification is needed
5. Return task result

### 4. Verification (`verification.ts`)

**Purpose:** Automatically detects and runs project validation commands.

**Key Functions:**
- `detectVerificationCommands(workspacePath, readFile, fileExists)` - Auto-detects project type
- `runVerification(command, type, execBash)` - Runs a verification command
- `verifyChanges(input, execBash, readFile, fileExists)` - Runs all appropriate verifications
- `selectVerifications(modifiedFiles, availableCommands)` - Determines which verifications to run

**Supported Project Types:**
- **Node.js/Bun** - Detects package.json scripts (test, build, lint, typecheck)
- **Rust** - cargo build, cargo test, cargo clippy
- **Go** - go build, go test
- **Java** - Maven (mvn) or Gradle
- **Python** - pytest

**Verification Types:**
- `build` - Compilation/build process
- `test` - Test suite execution
- `lint` - Code style/linting
- `typecheck` - Type checking (TypeScript, etc.)

### 5. Repair (`repair.ts`)

**Purpose:** Creates repair tasks for failed verifications.

**Key Functions:**
- `createRepairTask(input)` - Creates a repair task from verification failure
- `shouldCreateRepairTask(verification, retryCount)` - Determines if repair is appropriate
- `extractAffectedFiles(verification)` - Extracts file paths from error messages
- `createRepairTasks(originalTask, verifications)` - Creates multiple repair tasks

**Repair Strategy:**
- Analyzes verification errors
- Extracts affected files from error messages
- Creates focused repair task with error context
- Limits repair task retries (max 2)
- Prioritizes verification types: typecheck > build > test > lint

### 6. Orchestrator (`orchestrator.ts`)

**Purpose:** Main agent loop coordinating all components.

**Key Functions:**
- `orchestrate(input)` - Main orchestration function
- `previewPlan(model, goal, workspaceId)` - Creates plan preview without executing
- `resumeExecution(input, savedState)` - Resumes from saved state

**Orchestration Flow:**
1. **Create Plan** - Use planner to decompose goal
2. **Validate Plan** - Check for circular dependencies, etc.
3. **Execute Loop:**
   - Get next executable task
   - Execute task with LLM + tools
   - Run verification if needed
   - Create repair tasks or retry on failure
   - Emit progress events
   - Continue until complete
4. **Finalize** - Generate summary and return results

## Configuration

```typescript
interface AgentConfig {
  maxTasks: number;           // Maximum tasks in a plan (default: 20)
  maxRetries: number;         // Maximum retries per task (default: 3)
  taskTimeout: number;        // Timeout per task in ms (default: 300000)
  autoVerify: boolean;        // Auto-run verification (default: true)
  autoRepair: boolean;        // Auto-create repair tasks (default: true)
  maxConcurrentTools: number; // Max concurrent tool calls (default: 5)
  streamProgress: boolean;    // Stream progress updates (default: true)
}
```

## Usage Examples

### Basic Usage

```typescript
import { orchestrate } from "./agent";
import { resolveChatModel } from "../lib/models";
import { getToolContracts, Mode } from "@localcode/shared";
import { createToolExecutors } from "../lib/tool-executors";

const model = resolveChatModel("llama3.2");
const tools = getToolContracts(Mode.BUILD);
const toolExecutors = createToolExecutors("/path/to/workspace");

const result = await orchestrate({
  goal: "Add JWT authentication to the API",
  workspaceId: "workspace-123",
  model: model.model,
  tools,
  toolExecutors,
  onProgress: (event) => {
    console.log(`[${event.type}] ${event.message}`);
  },
});

console.log(result.summary);
```

### Preview Plan Only

```typescript
import { previewPlan } from "./agent";

const { plan, formattedPlan } = await previewPlan(
  model.model,
  "Add JWT authentication",
  "workspace-123"
);

console.log(formattedPlan);
// Displays formatted plan without executing
```

### Custom Configuration

```typescript
const result = await orchestrate({
  goal: "Refactor authentication system",
  workspaceId: "workspace-123",
  model: model.model,
  tools,
  toolExecutors,
  config: {
    maxTasks: 15,
    maxRetries: 2,
    autoVerify: true,
    autoRepair: false, // Manual repair only
  },
});
```

## Progress Events

The orchestrator emits progress events during execution:

```typescript
interface ProgressEvent {
  type: "plan-created" | "task-started" | "task-completed" | 
        "task-failed" | "plan-completed" | "plan-failed";
  plan: ExecutionPlan;
  task?: Task;
  message: string;
  timestamp: number;
}
```

**Event Types:**
- `plan-created` - Execution plan created
- `task-started` - Task execution started
- `task-completed` - Task completed successfully
- `task-failed` - Task failed (may retry)
- `plan-completed` - All tasks completed
- `plan-failed` - Execution failed

## API Endpoints

### POST `/api/v1/conversations/agent/stream`

Execute an agent plan with streaming progress.

**Request Body:**
```json
{
  "id": "workspace-id",
  "goal": "Add authentication",
  "model": "llama3.2",
  "previewOnly": false,
  "config": {
    "autoVerify": true,
    "autoRepair": true,
    "maxTasks": 20
  }
}
```

**Response:** Server-Sent Events stream

```
data: {"type":"plan-created","message":"Created plan with 5 tasks",...}
data: {"type":"task-started","message":"Starting: Read auth code",...}
data: {"type":"task-completed","message":"Completed: Read auth code",...}
...
```

### GET `/api/v1/conversations/agent/status/:id`

Get the status of an agent execution.

**Response:**
```json
{
  "goal": "Add authentication",
  "status": "completed",
  "summary": "Successfully added JWT auth...",
  "success": true,
  "tasks": [
    { "id": "task-1", "title": "Read auth code", "status": "completed" },
    ...
  ],
  "timestamp": 1234567890
}
```

## Best Practices

### 1. Task Granularity
- **Too broad:** "Implement authentication" (too vague)
- **Too granular:** "Add import statement", "Create variable" (micro-management)
- **Just right:** "Create JWT middleware", "Update login route"

### 2. Dependencies
- Only add dependencies when truly required
- Independent tasks can run in parallel
- Minimize dependency chains

### 3. Verification
- Always verify after significant changes
- Use appropriate verification type (build before test)
- Parse verification errors for repair context

### 4. Error Handling
- Retry for transient failures
- Create repair tasks for fixable errors
- Propagate permanent failures to dependents

### 5. Progress Communication
- Stream progress for long-running executions
- Provide clear task titles and descriptions
- Include context in progress messages

## Future Enhancements

### Planned Features

1. **Checkpoints** - Save/restore execution state at any point
2. **Rollback** - Undo failed changes automatically
3. **MCP Tool Integration** - Use MCP servers as specialized tools
4. **Multi-Agent Collaboration** - Multiple agents working together
5. **Git Integration** - Automatic commits, branches, PRs
6. **Interactive Mode** - User approval before critical changes
7. **Learning** - Improve planning based on past executions
8. **Cost Tracking** - Track token usage per task
9. **Parallel Execution** - Run independent tasks concurrently
10. **Custom Verifiers** - User-defined verification logic

### Extension Points

The architecture is designed for extensibility:

- **Custom Task Types** - Add new task types beyond analyze/modify/verify/repair
- **Custom Verifiers** - Implement domain-specific verification
- **Tool Plugins** - Add specialized tools for specific domains
- **Strategy Patterns** - Customize planning strategies
- **State Persistence** - Different storage backends for execution state

## Troubleshooting

### Plan Creation Fails
- Check model has sufficient context window
- Simplify the goal or break into smaller goals
- Review validation errors

### Tasks Get Stuck in BLOCKED
- Check for circular dependencies
- Verify dependency tasks completed successfully
- Review task dependencies in plan

### Verification Always Fails
- Ensure project commands are correct
- Check workspace path is valid
- Review verification command output
- Consider disabling autoVerify temporarily

### Repair Tasks Don't Help
- Review repair task descriptions
- Check if errors are actionable
- Consider manual intervention
- Adjust maxRetries if needed

## Contributing

When adding features to the agent system:

1. **Maintain modularity** - Keep components loosely coupled
2. **Add tests** - Test each module independently
3. **Document behavior** - Update this README
4. **Preserve interfaces** - Maintain backward compatibility
5. **Handle errors gracefully** - Fail gracefully, provide context

## License

MIT License - See LICENSE file for details

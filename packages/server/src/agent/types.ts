/**
 * Core type definitions for the autonomous agent system
 */

export enum TaskStatus {
  PENDING = "pending",
  RUNNING = "running",
  COMPLETED = "completed",
  FAILED = "failed",
  BLOCKED = "blocked",
}

export enum TaskType {
  ANALYZE = "analyze",
  MODIFY = "modify",
  VERIFY = "verify",
  REPAIR = "repair",
}

export interface Task {
  /** Unique task identifier */
  id: string;
  
  /** Human-readable task title */
  title: string;
  
  /** Detailed description of what the task should accomplish */
  description: string;
  
  /** Current task status */
  status: TaskStatus;
  
  /** Type of task for categorization */
  type: TaskType;
  
  /** IDs of tasks that must complete before this task can start */
  dependencies: string[];
  
  /** Number of times this task has been retried after failure */
  retryCount: number;
  
  /** Maximum allowed retries before marking as permanently failed */
  maxRetries: number;
  
  /** Error message if task failed */
  error?: string;
  
  /** Timestamp when task was created */
  createdAt: number;
  
  /** Timestamp when task started execution */
  startedAt?: number;
  
  /** Timestamp when task completed (success or failure) */
  completedAt?: number;
  
  /** Result data from task execution */
  result?: TaskResult;
}

export interface TaskResult {
  /** Whether the task succeeded */
  success: boolean;
  
  /** Summary of what was accomplished */
  summary: string;
  
  /** Files that were modified during this task */
  modifiedFiles?: string[];
  
  /** Commands that were executed */
  executedCommands?: string[];
  
  /** Verification results if applicable */
  verification?: VerificationResult;
  
  /** Any additional metadata */
  metadata?: Record<string, unknown>;
}

export interface VerificationResult {
  /** Whether verification passed */
  passed: boolean;
  
  /** Type of verification run */
  type: "build" | "test" | "lint" | "typecheck";
  
  /** Command that was executed */
  command: string;
  
  /** Exit code from command */
  exitCode: number;
  
  /** Standard output */
  stdout: string;
  
  /** Standard error */
  stderr: string;
  
  /** Parsed error messages */
  errors?: string[];
}

export interface ExecutionPlan {
  /** Unique plan identifier */
  id: string;
  
  /** Original user goal */
  goal: string;
  
  /** List of tasks to execute */
  tasks: Task[];
  
  /** Current execution status */
  status: "pending" | "running" | "completed" | "failed" | "paused";
  
  /** Timestamp when plan was created */
  createdAt: number;
  
  /** Timestamp when execution started */
  startedAt?: number;
  
  /** Timestamp when execution completed */
  completedAt?: number;
  
  /** Overall result summary */
  summary?: string;
}

export interface ExecutionState {
  /** Current execution plan */
  plan: ExecutionPlan;
  
  /** Index of currently executing task */
  currentTaskIndex: number;
  
  /** History of tool calls made during execution */
  toolCallHistory: ToolCallRecord[];
  
  /** Whether execution is paused */
  paused: boolean;
}

export interface ToolCallRecord {
  /** Task ID this tool call belongs to */
  taskId: string;
  
  /** Tool name that was called */
  toolName: string;
  
  /** Input arguments */
  input: Record<string, unknown>;
  
  /** Tool output */
  output: unknown;
  
  /** Timestamp of tool call */
  timestamp: number;
  
  /** Whether the tool call succeeded */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
}

export interface ProgressEvent {
  type: "plan-created" | "task-started" | "task-completed" | "task-failed" | "plan-completed" | "plan-failed";
  plan: ExecutionPlan;
  task?: Task;
  message: string;
  timestamp: number;
}

export interface PlannerInput {
  /** User's goal or request */
  goal: string;
  
  /** Current workspace context */
  workspaceId: string;
  
  /** Project files for context (from previous exploration) */
  contextFiles?: string[];
  
  /** Any constraints or preferences */
  constraints?: {
    /** Whether to run verification automatically */
    autoVerify?: boolean;
    
    /** Maximum number of tasks to generate */
    maxTasks?: number;
    
    /** Whether to create repair tasks automatically */
    autoRepair?: boolean;
  };
}

export interface ExecutorInput {
  /** Task to execute */
  task: Task;
  
  /** Workspace ID for file operations */
  workspaceId: string;
  
  /** Execution context from plan */
  context: {
    /** Overall goal */
    goal: string;
    
    /** Previously completed tasks */
    completedTasks: Task[];
    
    /** Results from dependent tasks */
    dependencyResults: Record<string, TaskResult>;
  };
}

export interface ExecutorOutput {
  /** Updated task with result */
  task: Task;
  
  /** Files that were modified */
  modifiedFiles: string[];
  
  /** Whether verification is needed */
  needsVerification: boolean;
}

export interface VerificationInput {
  /** Task that was executed */
  task: Task;
  
  /** Files that were modified */
  modifiedFiles: string[];
  
  /** Workspace ID */
  workspaceId: string;
}

export interface RepairInput {
  /** Task that failed verification */
  originalTask: Task;
  
  /** Verification result */
  verification: VerificationResult;
  
  /** Files that need fixing */
  affectedFiles: string[];
}

/**
 * Configuration for the agent system
 */
export interface AgentConfig {
  /** Maximum total tasks in a plan */
  maxTasks: number;
  
  /** Maximum retries per task */
  maxRetries: number;
  
  /** Timeout for individual tasks in milliseconds */
  taskTimeout: number;
  
  /** Whether to automatically verify after modifications */
  autoVerify: boolean;
  
  /** Whether to automatically create repair tasks */
  autoRepair: boolean;
  
  /** Maximum concurrent tool calls */
  maxConcurrentTools: number;
  
  /** Whether to stream progress updates */
  streamProgress: boolean;
}

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  maxTasks: 20,
  maxRetries: 3,
  taskTimeout: 300000, // 5 minutes
  autoVerify: true,
  autoRepair: true,
  maxConcurrentTools: 5,
  streamProgress: true,
};

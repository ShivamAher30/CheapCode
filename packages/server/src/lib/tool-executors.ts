/**
 * Tool Executors - Implementations for agent tool calls
 * 
 * These functions execute tools on behalf of the agent system,
 * translating between the agent's needs and the actual file system operations.
 */

import { readFile as fsReadFile, access } from "fs/promises";
import { resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface ToolExecutors {
  readFile: (path: string) => Promise<string>;
  fileExists: (path: string) => Promise<boolean>;
  execBash: (cmd: string, timeout?: number) => Promise<{ exitCode: number; stdout: string; stderr: string }>;
}

/**
 * Creates tool executors for a workspace
 */
export function createToolExecutors(workspacePath: string): ToolExecutors {
  const resolvePath = (relativePath: string) => {
    return resolve(workspacePath, relativePath);
  };
  
  return {
    async readFile(path: string): Promise<string> {
      try {
        const fullPath = resolvePath(path);
        const content = await fsReadFile(fullPath, "utf-8");
        return content;
      } catch (error) {
        throw new Error(`Failed to read file ${path}: ${error instanceof Error ? error.message : String(error)}`);
      }
    },
    
    async fileExists(path: string): Promise<boolean> {
      try {
        const fullPath = resolvePath(path);
        await access(fullPath);
        return true;
      } catch {
        return false;
      }
    },
    
    async execBash(cmd: string, timeout: number = 120000): Promise<{ exitCode: number; stdout: string; stderr: string }> {
      try {
        const { stdout, stderr } = await execAsync(cmd, {
          cwd: workspacePath,
          timeout,
          maxBuffer: 10 * 1024 * 1024, // 10MB
        });
        
        return {
          exitCode: 0,
          stdout: stdout || "",
          stderr: stderr || "",
        };
      } catch (error: any) {
        // exec throws on non-zero exit codes
        return {
          exitCode: error.code || 1,
          stdout: error.stdout || "",
          stderr: error.stderr || error.message || "",
        };
      }
    },
  };
}

import type { LanguageModelUsage } from "ai";
import type { SupportedChatModelId } from "./models";

/**
 * Tracks usage statistics for AI model interactions
 */
export interface UsageStats {
  modelId: SupportedChatModelId;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  requestCount: number;
  totalCostUsd: number;
  timestamp: number;
}

/**
 * Aggregate usage statistics across multiple requests
 */
export class UsageTracker {
  private stats: Map<SupportedChatModelId, UsageStats> = new Map();

  /**
   * Record usage for a model interaction
   */
  recordUsage(
    modelId: SupportedChatModelId,
    usage: LanguageModelUsage,
    costUsd: number
  ): void {
    const existing = this.stats.get(modelId);
    
    if (existing) {
      existing.totalTokens += usage.totalTokens;
      existing.inputTokens += usage.promptTokens;
      existing.outputTokens += usage.completionTokens;
      existing.requestCount += 1;
      existing.totalCostUsd += costUsd;
      existing.timestamp = Date.now();
    } else {
      this.stats.set(modelId, {
        modelId,
        totalTokens: usage.totalTokens,
        inputTokens: usage.promptTokens,
        outputTokens: usage.completionTokens,
        requestCount: 1,
        totalCostUsd: costUsd,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Get usage statistics for a specific model
   */
  getModelStats(modelId: SupportedChatModelId): UsageStats | undefined {
    return this.stats.get(modelId);
  }

  /**
   * Get all usage statistics
   */
  getAllStats(): UsageStats[] {
    return Array.from(this.stats.values());
  }

  /**
   * Get total usage across all models
   */
  getTotalStats(): Omit<UsageStats, "modelId"> {
    const all = this.getAllStats();
    
    return all.reduce(
      (acc, stat) => ({
        totalTokens: acc.totalTokens + stat.totalTokens,
        inputTokens: acc.inputTokens + stat.inputTokens,
        outputTokens: acc.outputTokens + stat.outputTokens,
        requestCount: acc.requestCount + stat.requestCount,
        totalCostUsd: acc.totalCostUsd + stat.totalCostUsd,
        timestamp: Math.max(acc.timestamp, stat.timestamp),
      }),
      {
        totalTokens: 0,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
        totalCostUsd: 0,
        timestamp: 0,
      }
    );
  }

  /**
   * Clear all statistics
   */
  clear(): void {
    this.stats.clear();
  }

  /**
   * Export statistics as JSON
   */
  toJSON(): Record<string, UsageStats> {
    const result: Record<string, UsageStats> = {};
    for (const [modelId, stats] of this.stats) {
      result[modelId] = stats;
    }
    return result;
  }

  /**
   * Import statistics from JSON
   */
  fromJSON(json: Record<string, UsageStats>): void {
    this.stats.clear();
    for (const [modelId, stats] of Object.entries(json)) {
      this.stats.set(modelId as SupportedChatModelId, stats);
    }
  }
}

/**
 * Global usage tracker instance
 */
export const globalUsageTracker = new UsageTracker();

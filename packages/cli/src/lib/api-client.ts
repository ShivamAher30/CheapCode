import { hc } from "hono/client";
import type { AppType } from "@localcode/server";

// Default timeout for API requests (30 seconds)
const DEFAULT_TIMEOUT_MS = 30000;

/**
 * Creates an AbortSignal that times out after the specified duration
 */
function createTimeoutSignal(timeoutMs: number): AbortSignal {
  const controller = new AbortController();
  setTimeout(() => controller.abort(), timeoutMs);
  return controller.signal;
}

export const apiClient = hc<AppType>(
  process.env.API_URL ?? "http://localhost:3000",
  {
    fetch: async (
      input: Parameters<typeof fetch>[0],
      init?: Parameters<typeof fetch>[1]
    ) => {
      // Add timeout unless explicitly disabled (signal = null) or already provided
      const signal = init?.signal === undefined 
        ? createTimeoutSignal(DEFAULT_TIMEOUT_MS)
        : init?.signal;

      try {
        const response = await fetch(input, { ...init, signal });
        return response;
      } catch (error) {
        // Convert AbortError to a more user-friendly timeout error
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${DEFAULT_TIMEOUT_MS}ms`);
        }
        throw error;
      }
    }
  }
);

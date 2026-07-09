import { useMemo, useState } from "react";
import { useChat as useAiChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  type InferUITools,
  lastAssistantMessageIsCompleteWithToolCalls,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { type ModeType, type SupportedChatModelId, type ToolContracts } from "@localcode/shared";
import { apiClient } from "../lib/api-client";
import { executeLocalTool } from "../lib/local-tools";

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const RETRY_BACKOFF_MULTIPLIER = 2;

// Enrichment configuration
const MAX_ENRICHMENT_FAILURES = 3;

export type ChatMessageMetadata = {
  mode?: ModeType;
  model?: SupportedChatModelId | string;
  durationMs?: number;
  usage?: LanguageModelUsage;
  enrichmentApplied?: string[];
};

type ChatTools = {
  [Name in keyof InferUITools<ToolContracts>]: {
    input: InferUITools<ToolContracts>[Name]["input"];
    output: unknown;
  };
};

export type Message = UIMessage<ChatMessageMetadata, never, ChatTools>;

/**
 * Retry a function with exponential backoff
 * @param fn - Function to retry
 * @param retries - Number of retries remaining
 * @param delay - Current delay in milliseconds
 * @returns Promise with the result or throws after all retries
 */
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  retries = MAX_RETRIES,
  delay = RETRY_DELAY_MS
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) throw error;
    
    // Check if error is retryable (network errors, 5xx status codes)
    const isRetryable = 
      error instanceof Error && 
      (error.message.includes('fetch') || 
       error.message.includes('network') ||
       error.message.includes('timeout'));
    
    if (!isRetryable) throw error;
    
    // Wait with exponential backoff
    await new Promise(resolve => setTimeout(resolve, delay));
    
    return retryWithBackoff(fn, retries - 1, delay * RETRY_BACKOFF_MULTIPLIER);
  }
}

export function useChat(workspaceId: string, initialMessages: Message[], groqApiKey?: string | null, ollamaBaseUrl?: string | null) {
  const [retryCount, setRetryCount] = useState(0);
  const [enrichmentEnabled, setEnrichmentEnabled] = useState(true);
  const [enrichmentFailures, setEnrichmentFailures] = useState(0);
  
  const transport = useMemo(() => {
    return new DefaultChatTransport<Message>({
      api: apiClient.api.v1.conversations.stream.$url().toString(),
      prepareSendMessagesRequest({ messages }) {
        const message = messages[messages.length - 1];
        if (!message) throw new Error("No message to send");

        const metadata = messages.findLast(
          (m) => m.metadata?.mode && m.metadata?.model,
        )?.metadata;
        const previousMessage = messages[messages.length - 2];
        const requestMessages =
          message.role === "assistant" && previousMessage?.role === "user"
            ? [previousMessage, message]
            : [message];

        return {
          body: {
            id: workspaceId,
            messages: requestMessages,
            mode: message.metadata?.mode ?? metadata?.mode,
            model: message.metadata?.model ?? metadata?.model,
            ...(groqApiKey ? { groqApiKey } : {}),
            ...(ollamaBaseUrl ? { ollamaBaseUrl } : {}),
          },
        }
      }
    });
  }, [workspaceId, groqApiKey, ollamaBaseUrl]);

  const chat = useAiChat<Message>({
    id: workspaceId,
    messages: initialMessages,
    transport,
    onToolCall({ toolCall }) {
      const mode = chat.messages.at(-1)?.metadata?.mode ?? "BUILD";

      void retryWithBackoff(() => 
        executeLocalTool(toolCall.toolName, toolCall.input, mode)
      )
        .then((output) => {
          setRetryCount(0); // Reset retry count on success
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            output,
          });
        })
        .catch((error) => {
          chat.addToolOutput({
            tool: toolCall.toolName as keyof ChatTools,
            toolCallId: toolCall.toolCallId,
            state: "output-error",
            errorText: error instanceof Error ? error.message : String(error),
          });
        });
    },
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithToolCalls,
  });

  return {
    messages: chat.messages,
    status: chat.status,
    error: chat.error,
    submit: async (params: { userText: string; mode: ModeType; model: SupportedChatModelId }) => {
      let finalText = params.userText;
      let enrichmentApplied: string[] | undefined;

      // Try enrichment if enabled and not disabled due to failures
      if (enrichmentEnabled && enrichmentFailures < MAX_ENRICHMENT_FAILURES) {
        try {
          const enrichmentResponse = await apiClient.api.v1.enrichment.analyze.$post({
            json: {
              userPrompt: params.userText,
              mode: params.mode,
              workspaceId,
              ...(groqApiKey ? { groqApiKey } : {}),
              ...(ollamaBaseUrl ? { ollamaBaseUrl } : {}),
            },
          });

          if (enrichmentResponse.ok) {
            const enrichmentData = await enrichmentResponse.json();
            
            // Use enriched prompt if enrichment was applied
            if (enrichmentData.wasEnriched) {
              finalText = enrichmentData.enrichedPrompt;
              enrichmentApplied = enrichmentData.enrichmentApplied;
            }
            
            // Reset failure count on success
            setEnrichmentFailures(0);
          } else {
            // Enrichment failed, increment failure count
            setEnrichmentFailures(prev => prev + 1);
            
            // Disable enrichment if we've hit max failures
            if (enrichmentFailures + 1 >= MAX_ENRICHMENT_FAILURES) {
              setEnrichmentEnabled(false);
              console.warn("Enrichment disabled due to repeated failures");
            }
          }
        } catch (error) {
          // Enrichment error, increment failure count but continue with original
          console.error("Enrichment error:", error);
          setEnrichmentFailures(prev => prev + 1);
          
          // Disable enrichment if we've hit max failures
          if (enrichmentFailures + 1 >= MAX_ENRICHMENT_FAILURES) {
            setEnrichmentEnabled(false);
            console.warn("Enrichment disabled due to repeated failures");
          }
        }
      }

      return chat.sendMessage({
        text: finalText,
        metadata: {
          mode: params.mode,
          model: params.model,
          enrichmentApplied,
        },
      });
    },
    abort: chat.stop,
    interrupt: chat.stop,
    enrichmentEnabled,
    toggleEnrichment: () => {
      setEnrichmentEnabled(prev => !prev);
      // Reset failure count when manually toggling
      setEnrichmentFailures(0);
    },
  };
};

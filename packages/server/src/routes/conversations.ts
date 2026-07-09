import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  convertToModelMessages,
  streamText,
  validateUIMessages,
  type InferUITools,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";
import { 
  getToolContracts, 
  modeSchema, 
  type ModeType, 
  type ToolContracts
} from "@localcode/shared";
import { buildSystemPrompt } from "../system-prompt";
import { isSupportedChatModel, resolveChatModel } from "../lib/models";
import { getWorkspace, updateWorkspaceMessages } from "./workspaces";

type ConversationMessageMetadata = {
  mode?: ModeType;
  model?: string;
  durationMs?: number;
  usage?: LanguageModelUsage;
};

type LocalCodeUIMessage = UIMessage<ConversationMessageMetadata, never, InferUITools<ToolContracts>>;

const submitSchema = z.object({
  id: z.string(),
  messages: z
    .array(
      z.custom<LocalCodeUIMessage>((value) => {
        return value != null && typeof value === "object" && "id" in value && "parts" in value;
      }),
    )
    .min(1),
  mode: modeSchema,
  model: z.string().refine(isSupportedChatModel, "Unsupported model"),
  groqApiKey: z.string().optional(),
  ollamaBaseUrl: z.string().optional(),
});

const submitValidator = zValidator("json", submitSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

function hasPendingToolCalls(message: LocalCodeUIMessage) {
  return message.parts.some((part) => {
    if (part.type === "dynamic-tool" || part.type.startsWith("tool-")) {
      const state = (part as { state?: string }).state;
      return state !== "output-available" && state !== "output-error";
    }

    return false;
  });
};

const app = new Hono()
  .post(
    "/stream",
    submitValidator,
    async (c) => {
      const { id, messages, mode, model, groqApiKey, ollamaBaseUrl } = c.req.valid("json");

      const workspace = getWorkspace(id);
      if (!workspace) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      const startTime = Date.now();
      const tools = getToolContracts(mode);
      const resolvedModel = resolveChatModel(model, groqApiKey, ollamaBaseUrl);
      const previousMessages = Array.isArray(workspace.messages)
        ? (workspace.messages as unknown as LocalCodeUIMessage[])
        : [];
      const mergedMessages = [...previousMessages];
      
      for (const message of messages) {
        const incomingMessage = {
          ...message,
          metadata: { ...message.metadata, mode, model },
        } satisfies LocalCodeUIMessage;

        const existingMessageIndex = mergedMessages.findIndex((m) => m.id === incomingMessage.id);

        if (existingMessageIndex === -1) {
          mergedMessages.push(incomingMessage);
        } else {
          mergedMessages[existingMessageIndex] = incomingMessage;
        }
      }

      const nextMessages = await validateUIMessages<LocalCodeUIMessage>({
        messages: mergedMessages,
        tools,
      });
      const modelMessages = await convertToModelMessages(nextMessages, { tools });
      let completedUsage: LanguageModelUsage | null = null;

      console.log(`[Chat] ${resolvedModel.provider}/${model} | mode=${mode} | msgs=${modelMessages.length}`);

      const result = streamText({
        model: resolvedModel.model,
        system: buildSystemPrompt({ mode, provider: resolvedModel.provider }),
        messages: modelMessages,
        tools,
        providerOptions: resolvedModel.providerOptions,
        onStepFinish(event) {
          const toolNames = event.toolCalls?.map(t => t.toolName).join(", ") || "none";
          console.log(`[Chat] step finish | text=${event.text.length}chars | tools=[${toolNames}]`);
        },
        onFinish(event) {
          completedUsage = event.totalUsage;
          console.log(`[Chat] done | steps=${event.steps.length} | usage=${JSON.stringify(event.totalUsage)}`);
        },
      });

      return result.toUIMessageStreamResponse<LocalCodeUIMessage>({
        originalMessages: nextMessages,
        messageMetadata({ part }) {
          if (part.type === "start") {
            return { mode, model };
          }

          if (part.type !== "finish") return undefined;

          return {
            mode,
            model,
            durationMs: Date.now() - startTime,
            ...(completedUsage ? { usage: completedUsage } : {}),
          };
        },
        async onFinish(event) {
          if (event.isAborted) return;
          if (hasPendingToolCalls(event.responseMessage)) return;

          updateWorkspaceMessages(id, event.messages);
        },
        onError(error) {
          return error instanceof Error ? error.message : String(error);
        },
      });
    },
  );

export default app;

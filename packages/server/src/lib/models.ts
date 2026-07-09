import { anthropic } from "@ai-sdk/anthropic";
import { openai, createOpenAI } from "@ai-sdk/openai";
import { createOllama } from "ollama-ai-provider";
import {
  findSupportedChatModel,
  type SupportedChatModel,
  type SupportedChatModelId,
  type SupportedProvider,
} from "@localcode/shared";
import type { ProviderOptions } from "@ai-sdk/provider-utils";
import type { LanguageModel } from "ai";

type AnthropicModelId = Extract<SupportedChatModel, { provider: "anthropic" }>["id"];
type OpenAIModelId = Extract<SupportedChatModel, { provider: "openai" }>["id"];
type OllamaModelId = Extract<SupportedChatModel, { provider: "ollama" }>["id"];
type GroqModelId = Extract<SupportedChatModel, { provider: "groq" }>["id"];

export type ResolvedModel = {
  model: LanguageModel;
  provider: SupportedProvider;
  modelId: SupportedChatModelId;
  providerOptions?: ProviderOptions;
};

// Initialize Ollama client with configurable base URL
const ollama = createOllama({
  baseURL: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434/api",
});

const ANTHROPIC_PROVIDER_OPTIONS: Partial<Record<AnthropicModelId, ProviderOptions>> = {
  "claude-opus-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      }
    },
  },
  "claude-sonnet-4-6": {
    anthropic: {
      thinking: {
        type: "enabled",
        budgetTokens: 10000,
      },
    },
  },
};

const OPENAI_PROVIDER_OPTIONS: Partial<Record<OpenAIModelId, ProviderOptions>> = {
  "gpt-5.4": {
    openai: {
      thinking: {
        reasoningSummary: "detailed",
      }
    },
  },
};

function assertUnsupportedProvider(provider: never): never {
  throw new Error(`Unsupported provider: ${provider}`);
};

function resolveAnthropicModel(modelId: AnthropicModelId): ResolvedModel {
  return {
    model: anthropic(modelId),
    provider: "anthropic",
    modelId,
    providerOptions: ANTHROPIC_PROVIDER_OPTIONS[modelId],
  };
};

function resolveOpenAIModel(modelId: OpenAIModelId): ResolvedModel {
  return {
    model: openai(modelId),
    provider: "openai",
    modelId,
    providerOptions: OPENAI_PROVIDER_OPTIONS[modelId],
  };
};

function resolveOllamaModel(modelId: OllamaModelId, ollamaBaseUrl?: string): ResolvedModel {
  const resolvedBaseUrl = ollamaBaseUrl || process.env.OLLAMA_BASE_URL || "http://localhost:11434/api";
  const customOllama = createOllama({
    baseURL: resolvedBaseUrl,
  });
  return {
    model: customOllama(modelId),
    provider: "ollama",
    modelId,
  };
};

/**
 * Resolve a Groq model using either a user-provided API key (BYOK)
 * or the server-configured GROQ_API_KEY from environment variables.
 * Uses OpenAI-compatible endpoint since Groq's API follows the OpenAI spec.
 */
function resolveGroqModel(modelId: GroqModelId, apiKey?: string): ResolvedModel {
  const resolvedApiKey = apiKey || process.env.GROQ_API_KEY;
  
  if (!resolvedApiKey) {
    throw new Error(
      "Groq API key is required. Use /groq command to set your API key, " +
      "or set GROQ_API_KEY in the server environment."
    );
  }

  // Use OpenAI-compatible provider pointed at Groq's endpoint
  const groq = createOpenAI({
    baseURL: "https://api.groq.com/openai/v1",
    apiKey: resolvedApiKey,
  });

  return {
    model: groq(modelId),
    provider: "groq",
    modelId,
    // Force tool use: without this, Llama/Mixtral just respond with text instead of calling tools.
    // "required" means the model MUST call at least one tool before giving a text response.
    providerOptions: {
      openai: {
        toolChoice: "required",
      },
    },
  };
};

function resolveSupportedChatModel(model: SupportedChatModel, groqApiKey?: string, ollamaBaseUrl?: string): ResolvedModel {
  const provider = model.provider;

  switch (provider) {
    case "anthropic":
      return resolveAnthropicModel(model.id);
    case "openai":
      return resolveOpenAIModel(model.id);
    case "ollama":
      return resolveOllamaModel(model.id, ollamaBaseUrl);
    case "groq":
      return resolveGroqModel(model.id, groqApiKey);
    default:
      return assertUnsupportedProvider(provider);
  }
};

export function isSupportedChatModel(modelId: string): modelId is SupportedChatModelId {
  return findSupportedChatModel(modelId) != null;
};

/**
 * Resolve a chat model by ID. For Groq models, an optional API key can be
 * provided by the user (BYOK). If not provided, falls back to the server's
 * GROQ_API_KEY environment variable.
 */
export function resolveChatModel(modelId: string, groqApiKey?: string, ollamaBaseUrl?: string): ResolvedModel {
  const model = findSupportedChatModel(modelId);
  if (!model) {
    throw new Error(`Unsupported model: ${modelId}`);
  }

  return resolveSupportedChatModel(model, groqApiKey, ollamaBaseUrl);
};

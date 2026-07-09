import { TextAttributes } from "@opentui/core";
import { useTheme } from "../providers/theme";
import { usePromptConfig } from "../providers/prompt-config";
import { Mode, findSupportedChatModel } from "@localcode/shared";

export function StatusBar() {
  const { mode, model, groqApiKey, ollamaBaseUrl } = usePromptConfig();
  const { colors } = useTheme();

  const modelInfo = findSupportedChatModel(model);
  const isGroq = modelInfo?.provider === "groq";
  const isOllama = modelInfo?.provider === "ollama";

  return (
    <box flexDirection="row" gap={1}>
      <text fg={mode === Mode.PLAN ? colors.planMode : colors.primary}>
        {mode === Mode.PLAN ? "Plan" : "Build"}
      </text>

      <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
        ›
      </text>
      <text>{model}</text>

      {isGroq && (
        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
          ›
        </text>
      )}
      {isGroq && (
        <text fg={groqApiKey ? "green" : "red"}>
          {groqApiKey ? "⚡Groq" : "⚡Groq (no key)"}
        </text>
      )}

      {isOllama && (
        <text attributes={TextAttributes.DIM} fg={colors.dimSeparator}>
          ›
        </text>
      )}
      {isOllama && (
        <text fg={ollamaBaseUrl ? "green" : "yellow"}>
          {ollamaBaseUrl ? `🦙Ollama (${ollamaBaseUrl})` : "🦙Ollama (default)"}
        </text>
      )}
    </box>
  );
};

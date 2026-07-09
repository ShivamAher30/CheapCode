import { useState, useCallback, useRef } from "react";
import { TextAttributes, type InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { SUPPORTED_CHAT_MODELS } from "@localcode/shared";
import type { SupportedChatModelId } from "@localcode/shared";
import { DialogSearchList } from "../dialog-search-list";

type GroqApiKeyDialogContentProps = {
  currentApiKey: string | null;
  onSetApiKey: (key: string | null) => void;
  onSelectModel: (model: SupportedChatModelId) => void;
};

const GROQ_MODELS = SUPPORTED_CHAT_MODELS.filter(m => m.provider === "groq");

function GroqApiKeyInput({
  currentApiKey,
  onSaveKey,
}: {
  currentApiKey: string | null;
  onSaveKey: (key: string) => void;
}) {
  const { colors } = useTheme();
  const inputRef = useRef<InputRenderable>(null);
  const { isTopLayer } = useKeyboardLayer();

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "return" || key.name === "enter") {
      const value = inputRef.current?.value?.trim() ?? "";
      if (value.length > 0) {
        onSaveKey(value);
      }
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.primary}>
        {"🔑 Enter your Groq API Key"}
      </text>
      <text attributes={TextAttributes.DIM}>
        {"Get your free API key at console.groq.com"}
      </text>
      {currentApiKey && (
        <text fg="green">
          {"✓ Key currently set (••••" + currentApiKey.slice(-4) + ")"}
        </text>
      )}
      <input
        ref={inputRef}
        placeholder="Paste your Groq API key (gsk_...)"
        focused
      />
      <text attributes={TextAttributes.DIM}>
        {"Press Enter to save"}
      </text>
    </box>
  );
}

function GroqModelSelect({
  apiKey,
  onSelectModel,
}: {
  apiKey: string;
  onSelectModel: (model: SupportedChatModelId) => void;
}) {
  const { colors } = useTheme();
  const dialog = useDialog();

  const handleSelect = useCallback(
    (model: typeof GROQ_MODELS[number]) => {
      onSelectModel(model.id as SupportedChatModelId);
      dialog.close();
    },
    [onSelectModel, dialog],
  );

  return (
    <box flexDirection="column" gap={1}>
      <text fg="green">
        {"✓ Groq API Key set (••••" + apiKey.slice(-4) + ")"}
      </text>
      <DialogSearchList
        items={[...GROQ_MODELS]}
        onSelect={handleSelect}
        filterFn={(model, query) => {
          return model.id.toLowerCase().includes(query.toLowerCase());
        }}
        renderItem={(model, isSelected) => (
          <box flexDirection="row" gap={1}>
            <text selectable={false} fg={isSelected ? "black" : "white"}>
              {model.id}
            </text>
            <text selectable={false} fg={isSelected ? "black" : "gray"}>
              {"$" + model.pricing.inputUsdPerMillionTokens + "/M in · $" + model.pricing.outputUsdPerMillionTokens + "/M out"}
            </text>
          </box>
        )}
        getKey={(model) => model.id}
        placeholder="Search Groq models"
        emptyText="No matching models"
      />
    </box>
  );
}

export const GroqApiKeyDialogContent = ({
  currentApiKey,
  onSetApiKey,
  onSelectModel,
}: GroqApiKeyDialogContentProps) => {
  const [phase, setPhase] = useState<"key" | "model">(currentApiKey ? "model" : "key");
  const [savedKey, setSavedKey] = useState(currentApiKey ?? "");

  const handleSaveKey = useCallback((key: string) => {
    onSetApiKey(key);
    setSavedKey(key);
    setPhase("model");
  }, [onSetApiKey]);

  if (phase === "key") {
    return (
      <GroqApiKeyInput
        currentApiKey={currentApiKey}
        onSaveKey={handleSaveKey}
      />
    );
  }

  return (
    <GroqModelSelect
      apiKey={savedKey}
      onSelectModel={onSelectModel}
    />
  );
};

import { useState, useCallback, useRef } from "react";
import { TextAttributes, type InputRenderable } from "@opentui/core";
import { useKeyboard } from "@opentui/react";
import { useDialog } from "../../providers/dialog";
import { useTheme } from "../../providers/theme";
import { useKeyboardLayer } from "../../providers/keyboard-layer";
import { SUPPORTED_CHAT_MODELS } from "@localcode/shared";
import type { SupportedChatModelId } from "@localcode/shared";
import { DialogSearchList } from "../dialog-search-list";

type OllamaDialogContentProps = {
  currentBaseUrl: string | null;
  onSetBaseUrl: (url: string | null) => void;
  onSelectModel: (model: SupportedChatModelId) => void;
};

const OLLAMA_MODELS = SUPPORTED_CHAT_MODELS.filter(m => m.provider === "ollama");

function OllamaBaseUrlInput({
  currentBaseUrl,
  onSaveUrl,
}: {
  currentBaseUrl: string | null;
  onSaveUrl: (url: string) => void;
}) {
  const { colors } = useTheme();
  const inputRef = useRef<InputRenderable>(null);
  const { isTopLayer } = useKeyboardLayer();

  useKeyboard((key) => {
    if (!isTopLayer("dialog")) return;

    if (key.name === "return" || key.name === "enter") {
      const value = inputRef.current?.value?.trim() ?? "";
      if (value.length > 0) {
        onSaveUrl(value);
      }
    }
  });

  return (
    <box flexDirection="column" gap={1}>
      <text fg={colors.primary}>
        {"🦙 Enter your Ollama Base URL"}
      </text>
      <text attributes={TextAttributes.DIM}>
        {"Default is http://localhost:11434/api. Specify a remote IP/port to connect over local network."}
      </text>
      {currentBaseUrl && (
        <text fg="green">
          {"✓ Base URL currently set: " + currentBaseUrl}
        </text>
      )}
      <input
        ref={inputRef}
        placeholder="http://localhost:11434/api"
        defaultValue={currentBaseUrl ?? "http://localhost:11434/api"}
        focused
      />
      <text attributes={TextAttributes.DIM}>
        {"Press Enter to connect and continue"}
      </text>
    </box>
  );
}

function OllamaModelSelect({
  baseUrl,
  onSelectModel,
}: {
  baseUrl: string;
  onSelectModel: (model: SupportedChatModelId) => void;
}) {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (model: typeof OLLAMA_MODELS[number]) => {
      onSelectModel(model.id as SupportedChatModelId);
      dialog.close();
    },
    [onSelectModel, dialog],
  );

  return (
    <box flexDirection="column" gap={1}>
      <text fg="green">
        {"✓ Ollama Base URL set to: " + baseUrl}
      </text>
      <DialogSearchList
        items={[...OLLAMA_MODELS]}
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
              {"(Free local model)"}
            </text>
          </box>
        )}
        getKey={(model) => model.id}
        placeholder="Search Ollama models"
        emptyText="No matching models"
      />
    </box>
  );
}

export const OllamaDialogContent = ({
  currentBaseUrl,
  onSetBaseUrl,
  onSelectModel,
}: OllamaDialogContentProps) => {
  const [phase, setPhase] = useState<"url" | "model">(currentBaseUrl ? "model" : "url");
  const [savedUrl, setSavedUrl] = useState(currentBaseUrl ?? "http://localhost:11434/api");

  const handleSaveUrl = useCallback((url: string) => {
    onSetBaseUrl(url);
    setSavedUrl(url);
    setPhase("model");
  }, [onSetBaseUrl]);

  if (phase === "url") {
    return (
      <OllamaBaseUrlInput
        currentBaseUrl={currentBaseUrl}
        onSaveUrl={handleSaveUrl}
      />
    );
  }

  return (
    <OllamaModelSelect
      baseUrl={savedUrl}
      onSelectModel={onSelectModel}
    />
  );
};

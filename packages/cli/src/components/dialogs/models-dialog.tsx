import { useCallback } from "react";
import { useDialog } from "../../providers/dialog";
import { DialogSearchList } from "../dialog-search-list";
import { Mode } from "@localcode/database/enums";
import type { SupportedChatModelId } from "@localcode/shared";
import { SUPPORTED_CHAT_MODELS } from "@localcode/shared";

type ModelsDialogContentProps = {
  models: SupportedChatModelId[];
  onSelectModel: (modelId: SupportedChatModelId) => void;
};

export const ModelsDialogContent = ({ 
  models, 
  onSelectModel 
}: ModelsDialogContentProps) => {
  const dialog = useDialog();

  const handleSelect = useCallback(
    (modelId: SupportedChatModelId) => {
      onSelectModel(modelId);
      dialog.close();
    },
    [dialog, onSelectModel],
  );

  // Get provider for each model
  const getModelInfo = (modelId: SupportedChatModelId) => {
    const model = SUPPORTED_CHAT_MODELS.find(m => m.id === modelId);
    return model;
  };

  return (
    <DialogSearchList
      items={models}
      onSelect={handleSelect}
      filterFn={(modelId, query) => {
        const model = getModelInfo(modelId);
        const searchText = `${modelId} ${model?.provider || ''}`.toLowerCase();
        return searchText.includes(query.toLowerCase());
      }}
      renderItem={(modelId, isSelected) => {
        const model = getModelInfo(modelId);
        const isLocal = model?.provider === "ollama";
        
        return (
          <box flexDirection="row" gap={1}>
            <text selectable={false} fg={isSelected ? "black" : "white"}>
              {modelId}
            </text>
            {isLocal && (
              <text selectable={false} fg={isSelected ? "green" : "green"}>
                [Local]
              </text>
            )}
            {model && model.provider !== "ollama" && (
              <text selectable={false} fg={isSelected ? "gray" : "gray"} dim>
                ({model.provider})
              </text>
            )}
          </box>
        );
      }}
      getKey={(modelId) => modelId}
      placeholder="Search models (type 'local' for Ollama)"
      emptyText="No matching models"
    />
  );
};

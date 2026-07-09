import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import { 
  DEFAULT_CHAT_MODEL_ID, 
  Mode,
  type ModeType,
  type SupportedChatModelId,
} from "@localcode/shared";

type PromptConfigContextValue = {
  mode: ModeType;
  toggleMode: () => void;
  setMode: (mode: ModeType) => void;
  model: SupportedChatModelId;
  setModel: (model: SupportedChatModelId) => void;
  groqApiKey: string | null;
  setGroqApiKey: (key: string | null) => void;
  ollamaBaseUrl: string | null;
  setOllamaBaseUrl: (url: string | null) => void;
};

const PromptConfigContext = createContext<PromptConfigContextValue | null>(null);

export function usePromptConfig(): PromptConfigContextValue {
  const value = useContext(PromptConfigContext);
  if (!value) {
    throw new Error("usePromptConfig must be used within a PromptConfigProvider");
  }
  return value;
};

type PromptConfigProviderProps = {
  children: ReactNode;
};

export function PromptConfigProvider({ children }: PromptConfigProviderProps) {
  const [mode, setMode] = useState<ModeType>(Mode.BUILD);
  const [model, setModel] = useState<SupportedChatModelId>(DEFAULT_CHAT_MODEL_ID);
  const [groqApiKey, setGroqApiKey] = useState<string | null>(null);
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState<string | null>(null);

  const toggleMode = useCallback(() => {
    setMode((m) => (m === Mode.BUILD ? Mode.PLAN : Mode.BUILD));
  }, []);

  return (
    <PromptConfigContext.Provider 
      value={{ 
        mode, 
        toggleMode, 
        setMode, 
        model, 
        setModel,
        groqApiKey,
        setGroqApiKey,
        ollamaBaseUrl,
        setOllamaBaseUrl,
    }}>
      {children}
    </PromptConfigContext.Provider>
  );
};

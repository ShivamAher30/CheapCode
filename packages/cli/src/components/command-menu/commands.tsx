import { SUPPORTED_CHAT_MODELS } from "@localcode/shared";
import { 
  AgentsDialogContent,
  GroqApiKeyDialogContent,
  OllamaDialogContent,
  ModelsDialogContent,
  WorkspacesDialogContent,
  ThemeDialogContent,
} from "../dialogs";
import type { Command } from "./types";

export const COMMANDS: Command[] = [
  {
    name: "new",
    description: "Start a new conversation",
    value: "/new",
    action: (ctx) => {
      ctx.navigate("/");
    },
  },
  {
    name: "agents",
    description: "Switch agents",
    value: "/agents",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Agent",
        children: <AgentsDialogContent currentMode={ctx.mode} onSelectMode={ctx.setMode} />,
      })
    },
  },
  {
    name: "models",
    description: "Select AI model for generation",
    value: "/models",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Model",
        children: (
          <ModelsDialogContent
            models={SUPPORTED_CHAT_MODELS.map((model) => model.id)}
            onSelectModel={ctx.setModel}
          />
        ),
      })
    },
  },
  {
    name: "groq",
    description: "Set Groq API key (BYOK) and select model",
    value: "/groq",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Groq (BYOK)",
        children: (
          <GroqApiKeyDialogContent
            currentApiKey={ctx.groqApiKey}
            onSetApiKey={ctx.setGroqApiKey}
            onSelectModel={ctx.setModel}
          />
        ),
      });
    },
  },
  {
    name: "ollama",
    description: "Configure Ollama Base URL and select local model",
    value: "/ollama",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Ollama (Local/Network)",
        children: (
          <OllamaDialogContent
            currentBaseUrl={ctx.ollamaBaseUrl}
            onSetBaseUrl={ctx.setOllamaBaseUrl}
            onSelectModel={ctx.setModel}
          />
        ),
      });
    },
  },
  {
    name: "workspaces",
    description: "Browse past workspaces",
    value: "/workspaces",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Workspaces",
        children: <WorkspacesDialogContent />,
      })
    },
  },
  {
    name: "theme",
    description: "Change color theme",
    value: "/theme",
    action: (ctx) => {
      ctx.dialog.open({
        title: "Select Theme",
        children: <ThemeDialogContent />,
      })
    },
  },
  {
    name: "exit",
    description: "Quit the application",
    value: "/exit",
    action: (ctx) => {
      ctx.exit();
    },
  },
];

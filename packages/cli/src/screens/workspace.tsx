import { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useLocation, useNavigate } from "react-router";
import { z } from "zod";
import { useKeyboard } from "@opentui/react";
import { type ModeType, type SupportedChatModelId } from "@localcode/shared";
import type { InferResponseType } from "hono/client";
import { WorkspaceShell } from "../components/workspace-shell";
import { 
  UserMessage, 
  BotMessage, 
  ErrorMessage
} from "../components/messages";
import { useToast } from "../providers/toast";
import { useChat } from "../hooks/use-chat";
import { usePromptConfig } from "../providers/prompt-config";
import type { Message } from "../hooks/use-chat";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";
import { useKeyboardLayer } from "../providers/keyboard-layer";

type WorkspaceData = InferResponseType<(typeof apiClient.api.v1.workspaces)[":id"]["$get"], 200>;

const workspaceLocationSchema = z.object({
  workspace: z.custom<WorkspaceData>((val) => val != null && typeof val === "object" && "id" in val),
  initialPrompt: z
    .object({
      message: z.string(),
      mode: z.custom<ModeType>(),
      model: z.custom<SupportedChatModelId>(),
    })
    .optional(),
});

function ChatMessage(
  { msg }: {
    msg: Message
  }
) {
  if (msg.role === "user") {
    const text = msg.parts
      .filter((p) => p.type === "text")
      .map((p) => p.text)
      .join("");

    return <UserMessage message={text} mode={msg.metadata?.mode ?? "BUILD"} />;
  }

  return (
    <BotMessage
      parts={msg.parts}
      model={msg.metadata?.model ?? "unknown"}
      mode={msg.metadata?.mode ?? "BUILD"}
      durationMs={msg.metadata?.durationMs}
      streaming={false}
    />
  );
};

function WorkspaceChat({ 
  workspace,
  initialPrompt,
}: { 
  workspace: WorkspaceData,
  initialPrompt?: { message: string; mode: ModeType; model: SupportedChatModelId };
}) {
  const [initialMessages] = useState(() => workspace.messages as unknown as Message[]);
  const { mode, model, groqApiKey, ollamaBaseUrl } = usePromptConfig();
  const { isTopLayer } = useKeyboardLayer();
  const { messages, status, submit, abort, interrupt, error } = useChat(
    workspace.id,
    initialMessages,
    groqApiKey,
    ollamaBaseUrl,
  );
  const hasSubmittedInitialPromptRef = useRef(false);

  // Stop the pending reply when the user leaves this workspace.
  useEffect(() => {
    return () => {
      void abort();
    };
  }, [abort]);

  // Let the user cancel a reply even before the first streamed chunk arrives.
  useKeyboard((key) => {
    if (key.name === "escape" && isTopLayer("base") && status === "streaming") {
      key.preventDefault();
      interrupt();
    }
  });

  useEffect(() => {
    if (!initialPrompt || hasSubmittedInitialPromptRef.current) return;
    hasSubmittedInitialPromptRef.current = true;
    void submit({
      userText: initialPrompt.message,
      mode: initialPrompt.mode,
      model: initialPrompt.model,
    });
  }, [initialPrompt, submit]);

  return (
    <WorkspaceShell
      onSubmit={(text) => submit({ userText: text, mode, model })}
      loading={status === "submitted" || status === "streaming"}
      interruptible={status === "submitted" || status === "streaming"}
    >
      {messages.map((msg) => (
        <ChatMessage key={msg.id} msg={msg} />
      ))}
      {error && <ErrorMessage message={error.message} />}
    </WorkspaceShell>
  );
}

export function Workspace() {
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const toast = useToast();

  const prefetched = useMemo(() => {
    const parsed = workspaceLocationSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state]);

  const [workspace, setWorkspace] = useState<WorkspaceData | null>(prefetched?.workspace ?? null);

  useEffect(() => {
    // Skip fetch if workspace was passed via location state
    if (prefetched?.workspace) return;

    setWorkspace(null);

    if (!id) return;

    let ignore = false;
    const fetchWorkspace = async () => {
      try {
        const res = await apiClient.api.v1.workspaces[":id"].$get({ 
          param: { id },
        });
        if (ignore) return;
        if (!res.ok) throw new Error(await getErrorMessage(res));
        const resolved = await res.json();
        setWorkspace(resolved);
      } catch (err) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: err instanceof Error ? err.message : "Failed to load workspace",
        });
        navigate("/", { replace: true });
      }
    };

    fetchWorkspace();
    return () => {
      ignore = true;
    };
  }, [id, prefetched, toast, navigate]);

  if (!workspace) {
    return <WorkspaceShell onSubmit={() => {}} inputDisabled loading />;
  }

  return (
    <WorkspaceChat 
      key={workspace.id} 
      workspace={workspace} 
      initialPrompt={prefetched?.initialPrompt}
    />
  );
};

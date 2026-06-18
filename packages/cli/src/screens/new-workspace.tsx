import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { Mode, modeSchema } from "@localcode/shared";
import { useNavigate, useLocation } from "react-router";
import { WorkspaceShell } from "../components/workspace-shell";
import { UserMessage } from "../components/messages";
import { useToast } from "../providers/toast";
import { apiClient } from "../lib/api-client";
import { getErrorMessage } from "../lib/http-errors";

const newWorkspaceStateSchema = z.object({
  message: z.string(),
  mode: modeSchema,
  model: z.string(),
});

export function NewWorkspace() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const hasStartedRef = useRef(false);

  const state = useMemo(() => {
    const parsed = newWorkspaceStateSchema.safeParse(location.state);
    return parsed.success ? parsed.data : null;
  }, [location.state])

  // Guard: if navigated here directly without state, go home
  useEffect(() => {
    if (!state) {
      navigate("/", { replace: true });
    }
  }, [state, navigate]);

  // Create the workspace on mount — this screen exists to do this
  useEffect(() => {
    if (!state || hasStartedRef.current) return;

    hasStartedRef.current = true;

    let ignore = false;
    const createWorkspace = async () => {
      try {
        const res = await apiClient.api.v1.workspaces.create.$post({
          json: {
            title: state.message.slice(0, 100),
          },
        });

        if (ignore) return;
        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }
        const workspace = await res.json();
        navigate(
          `/workspaces/${workspace.id}`,
          { replace: true, state: { workspace, initialPrompt: state } }
        );
      } catch (error) {
        if (ignore) return;
        toast.show({
          variant: "error",
          message: error instanceof Error ? error.message : "Failed to create workspace",
        });
        navigate("/", { replace: true });
      }
    };

    createWorkspace();
    return () => {
      ignore = true;
    };
  }, [state, navigate, toast]);

  if (!state) return null;

  return (
    <WorkspaceShell onSubmit={() => {}} inputDisabled loading>
      <UserMessage message={state.message} mode={state.mode} />
    </WorkspaceShell>
  );
};

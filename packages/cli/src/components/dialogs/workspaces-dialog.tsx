import { useCallback, useEffect, useState } from "react";
import { TextAttributes } from "@opentui/core";
import { format } from "date-fns";
import { useNavigate } from "react-router";
import { useDialog } from "../../providers/dialog";
import { useToast } from "../../providers/toast";
import { apiClient } from "../../lib/api-client";
import { getErrorMessage } from "../../lib/http-errors";
import { DialogSearchList } from "../dialog-search-list";
import type { InferResponseType } from "hono/client";

type Workspace = InferResponseType<(typeof apiClient.api.v1.workspaces.list)["$get"], 200>[number];

export const WorkspacesDialogContent = () => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const { close } = useDialog();
  const navigate = useNavigate();
  const { show } = useToast();

  useEffect(() => {
    let ignore = false;

    const fetchWorkspaces = async () => {
      try {
        const res = await apiClient.api.v1.workspaces.list.$get();
        if (!res.ok) {
          throw new Error(await getErrorMessage(res));
        }

        const data = await res.json();

        if (!ignore) {
          setWorkspaces(data);
          setLoading(false);
        }
      } catch (error) {
        if (!ignore) {
          show({
            variant: "error",
            message: error instanceof Error ? error.message : "Failed to fetch workspaces",
          });
          close();
        }
      }
    };

    fetchWorkspaces();

    return () => {
      ignore = true;
    };
  }, [close, show]);

  const handleSelect = useCallback(
    (workspace: Workspace) => {
      close();
      navigate(`/workspaces/${workspace.id}`);
    },
    [close, navigate],
  );

  if (loading) {
    return (
      <box flexDirection="column">
        <text attributes={TextAttributes.DIM}>Loading workspaces...</text>
      </box>
    );
  }

  return (
    <DialogSearchList
      items={workspaces}
      onSelect={handleSelect}
      filterFn={(w, query) => w.title.toLowerCase().includes(query.toLowerCase())}
      renderItem={(workspace, isSelected) => (
        <>
          <text selectable={false} fg={isSelected ? "black" : "white"}>
            {workspace.title}
          </text>
          <box flexGrow={1} />
          <text
            selectable={false}
            fg={isSelected ? "black" : undefined}
            attributes={TextAttributes.DIM}
          >
            {format(new Date(workspace.createdAt), "hh:mm a")}
          </text>
        </>
      )}
      getKey={(w) => w.id}
      placeholder="Search workspaces"
      emptyText="No matching workspaces"
    />
  );
};


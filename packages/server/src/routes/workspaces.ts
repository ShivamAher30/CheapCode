import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { randomUUID } from "crypto";

// Simple in-memory workspace store (no database needed)
type Workspace = {
  id: string;
  title: string;
  path: string;
  messages: unknown;
  createdAt: string;
};

const workspaces = new Map<string, Workspace>();

export function getWorkspace(id: string) {
  return workspaces.get(id) ?? null;
}

export function updateWorkspaceMessages(id: string, messages: unknown) {
  const ws = workspaces.get(id);
  if (ws) {
    ws.messages = messages;
  }
}

const createWorkspaceSchema = z.object({
  title: z.string(),
});

const createWorkspaceValidator = zValidator(
  "json", createWorkspaceSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

const app = new Hono()
  .get("/list", (c) => {
    const list = Array.from(workspaces.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(({ id, title, createdAt }) => ({ id, title, createdAt }));

    return c.json(list);
  })
  .get("/:id", (c) => {
    const id = c.req.param("id");
    const workspace = workspaces.get(id);

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    return c.json(workspace);
  })
  .post("/create", createWorkspaceValidator, (c) => {
    const data = c.req.valid("json");

    const workspace: Workspace = {
      id: randomUUID(),
      title: data.title,
      path: process.cwd(),
      messages: [],
      createdAt: new Date().toISOString(),
    };

    workspaces.set(workspace.id, workspace);
    return c.json(workspace, 201);
  });

export default app;

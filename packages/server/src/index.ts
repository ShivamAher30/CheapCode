import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import workspaces from "./routes/workspaces";
import conversations from "./routes/conversations";
import agentConversations from "./routes/agent-conversations";
import { enrichmentRoutes } from "./routes/enrichment";

const app = new Hono();

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return c.json({ 
      error: error.message || "Request failed",
    }, error.status);
  };

  console.error("Unhandled server error", error);
  return c.json({ error: "Internal server error" }, 500);
});

const routes = app
  .route("/api/v1/workspaces", workspaces)
  .route("/api/v1/conversations", conversations)
  .route("/api/v1/conversations", agentConversations)
  .route("/api/v1/enrichment", enrichmentRoutes);

export type AppType = typeof routes;
// idleTimeout must be high, otherwise LLM tool calls might not complete
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };

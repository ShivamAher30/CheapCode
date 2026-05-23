import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";

import { requireAuth } from "./middleware/require-auth";
import workspaces from "./routes/workspaces";
import conversations from "./routes/conversations";
import authentication from "./routes/authentication";
import payments from "./routes/payments";

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

// API v1 routes with authentication middleware
app.use("/api/v1/workspaces/*", requireAuth);
app.use("/api/v1/conversations/*", requireAuth);
app.use("/api/v1/payments/checkout", requireAuth);
app.use("/api/v1/payments/portal", requireAuth);

const routes = app
  .route("/api/v1/authentication", authentication)
  .route("/api/v1/payments", payments)
  .route("/api/v1/workspaces", workspaces)
  .route("/api/v1/conversations", conversations);

export type AppType = typeof routes;
// idleTimeout must be high, otherwise LLM tool calls might not complete
export default { port: 3000, fetch: app.fetch, idleTimeout: 255 };

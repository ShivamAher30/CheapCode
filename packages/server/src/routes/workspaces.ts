import { Hono } from "hono";
// import { HTTPException } from "hono/http-exception";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { db } from "@localcode/database/client";

import type { AuthenticatedEnv } from "../middleware/require-auth";
import { requireCreditsBalance } from "../middleware/require-credits-balance";


const createWorkspaceSchema = z.object({
  title: z.string(),
});

const createWorkspaceValidator = zValidator(
  "json", createWorkspaceSchema, (result, c) => {
  if (!result.success) {
    return c.json({ error: "Invalid request body" }, 400);
  }
});

const app = new Hono<AuthenticatedEnv>()
  .get("/list", async (c) => {
    const userId = c.get("userId");

    const workspaces = await db.workspace.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        createdAt: true,
      },
    });

    return c.json(workspaces);
  })
  .get("/:id", async (c) => {
    // MOCK: Uncomment to simulate slow workspace loading
    // await new Promise((r) => setTimeout(r, 5000))

    // MOCK: Uncomment to simulate workspace loading error
    // throw new HTTPException(
    //   500, 
    //   { message: "Mock error: workspace loading failed" }
    // )

    const id = c.req.param("id");
    const userId = c.get("userId");
    
    const workspace = await db.workspace.findUnique({
      where: { id, userId },
    });

    if (!workspace) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    return c.json(workspace);
  })
  .post("/create", requireCreditsBalance, createWorkspaceValidator, async (c) => {
    // MOCK: Uncomment to simulate slow workspace creation
    // await new Promise((r) => setTimeout(r, 5000))

    // MOCK: Uncomment to simulate workspace creation error
    // throw new HTTPException(
    //   500, 
    //   { message: "Mock error: workspace creation failed" }
    // )

    const userId = c.get("userId");
    const data = c.req.valid("json");

    const workspace = await db.workspace.create({
      data: {
        ...data,
        userId,
      },
    });

    return c.json(workspace, 201);
  });

export default app;

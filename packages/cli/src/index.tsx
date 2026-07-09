import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import { createMemoryRouter, RouterProvider } from "react-router";
import { RootLayout } from "./layouts/root-layout";
import { Home } from "./screens/home";
import { NewWorkspace } from "./screens/new-workspace";
import { Workspace } from "./screens/workspace";
import server from "@localcode/server";

// Start the backend server programmatically on port 3000 if not already running
try {
  Bun.serve({
    port: 3000,
    fetch: server.fetch,
    idleTimeout: 255,
  });
} catch (error) {
  // Server might already be running (e.g., in dev mode)
}


const router = createMemoryRouter([
  {
    path: "/",
    element: <RootLayout />,
    children: [
      { index: true, element: <Home /> },
      { path: "workspaces/new", element: <NewWorkspace /> },
      { path: "workspaces/:id", element: <Workspace /> },
    ]
  }
]);

function App() {
  return <RouterProvider router={router} />
}

const renderer = await createCliRenderer({
  targetFps: 60,
  exitOnCtrlC: false,
});
createRoot(renderer).render(<App />);

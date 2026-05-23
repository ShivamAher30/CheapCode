import { createClerkClient } from "@clerk/backend";

// Make Clerk optional for local development
const hasClerkConfig = process.env.CLERK_SECRET_KEY && process.env.CLERK_PUBLISHABLE_KEY;

const clerkClient = hasClerkConfig ? createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY!,
  publishableKey: process.env.CLERK_PUBLISHABLE_KEY!,
}) : null;

export async function authenticateOAuthRequest(request: Request) {
  // Skip auth if Clerk is not configured (development mode)
  if (!clerkClient) {
    return { userId: "dev-user" };
  }

  const requestState = await clerkClient.authenticateRequest(request, {
    acceptsToken: "oauth_token",
  });

  if (!requestState.isAuthenticated) {
    return null;
  }

  const auth = requestState.toAuth();
  if (auth.tokenType !== "oauth_token" || !auth.userId) {
    return null;
  }

  return { userId: auth.userId };
};

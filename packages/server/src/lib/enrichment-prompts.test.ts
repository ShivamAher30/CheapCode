/**
 * Unit tests for enrichment prompt builder
 * 
 * Tests the buildEnrichmentPrompt function to ensure it correctly generates
 * prompts for the enrichment model based on intent, mode, and context.
 */

import { describe, it, expect } from "vitest";
import { buildEnrichmentPrompt, type EnrichmentPromptParams, type ConversationMessage } from "./enrichment-prompts";
import { Mode } from "@localcode/shared";
import type { WorkspaceContext } from "./workspace-context";

describe("buildEnrichmentPrompt", () => {
  it("should build a basic enrichment prompt with minimal parameters", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "add login",
      intent: "implementation",
      mode: Mode.BUILD,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("add login");
    expect(result).toContain("BUILD");
    expect(result).toContain("enrichment assistant");
  });

  it("should include PLAN mode guidance when mode is PLAN", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "how does auth work?",
      intent: "question",
      mode: Mode.PLAN,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("PLAN");
    expect(result).toContain("analysis and exploration");
    expect(result).toContain("DO NOT suggest file modifications");
    expect(result).toContain("read-only operations");
  });

  it("should include BUILD mode guidance when mode is BUILD", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "create a login form",
      intent: "implementation",
      mode: Mode.BUILD,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("BUILD");
    expect(result).toContain("implementation and modification");
    expect(result).toContain("file operations");
  });

  it("should include workspace context when provided", () => {
    const workspaceContext: WorkspaceContext = {
      technologies: ["React", "TypeScript", "Node.js"],
      fileStructureSummary: "Node.js project, source in /src",
      recentFiles: ["src/App.tsx", "src/index.tsx"],
      projectName: "my-app",
    };

    const params: EnrichmentPromptParams = {
      userPrompt: "add a button",
      intent: "implementation",
      mode: Mode.BUILD,
      workspaceContext,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("React");
    expect(result).toContain("TypeScript");
    expect(result).toContain("Node.js");
    expect(result).toContain("my-app");
    expect(result).toContain("src/App.tsx");
  });

  it("should include conversation history when provided", () => {
    const conversationHistory: ConversationMessage[] = [
      { role: "user", content: "Show me the auth code" },
      { role: "assistant", content: "Here's the auth code from auth.ts..." },
    ];

    const params: EnrichmentPromptParams = {
      userPrompt: "now add validation",
      intent: "implementation",
      mode: Mode.BUILD,
      conversationHistory,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("Recent Conversation");
    expect(result).toContain("Show me the auth code");
    expect(result).toContain("auth.ts");
  });

  it("should include intent-specific instructions for implementation", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "add login",
      intent: "implementation",
      mode: Mode.BUILD,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("technical requirements");
    expect(result).toContain("acceptance criteria");
  });

  it("should include intent-specific instructions for question", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "how does it work?",
      intent: "question",
      mode: Mode.PLAN,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("information");
    expect(result).toContain("clarify");
  });

  it("should include intent-specific instructions for debug", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "fix the error",
      intent: "debug",
      mode: Mode.BUILD,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("expected behavior");
    expect(result).toContain("investigation");
  });

  it("should include general guidelines in all prompts", () => {
    const params: EnrichmentPromptParams = {
      userPrompt: "test",
      intent: "implementation",
      mode: Mode.BUILD,
    };

    const result = buildEnrichmentPrompt(params);

    expect(result).toContain("Preserve the user's original intent");
    expect(result).toContain("Provide ONLY the enriched prompt text");
    expect(result).toContain("Output the enhanced prompt directly");
  });

  it("should truncate long conversation history messages", () => {
    const longMessage = "a".repeat(500);
    const conversationHistory: ConversationMessage[] = [
      { role: "user", content: longMessage },
    ];

    const params: EnrichmentPromptParams = {
      userPrompt: "continue",
      intent: "implementation",
      mode: Mode.BUILD,
      conversationHistory,
    };

    const result = buildEnrichmentPrompt(params);

    // Should be truncated with "..."
    expect(result).toContain("...");
    // Should not contain the full 500 characters
    expect(result.indexOf(longMessage)).toBe(-1);
  });

  it("should limit conversation history to last 5 messages", () => {
    const conversationHistory: ConversationMessage[] = [
      { role: "user", content: "message 1" },
      { role: "assistant", content: "response 1" },
      { role: "user", content: "message 2" },
      { role: "assistant", content: "response 2" },
      { role: "user", content: "message 3" },
      { role: "assistant", content: "response 3" },
      { role: "user", content: "message 4" },
      { role: "assistant", content: "response 4" },
    ];

    const params: EnrichmentPromptParams = {
      userPrompt: "continue",
      intent: "implementation",
      mode: Mode.BUILD,
      conversationHistory,
    };

    const result = buildEnrichmentPrompt(params);

    // Should not include message 1 and response 1 (oldest)
    expect(result).not.toContain("message 1");
    expect(result).not.toContain("response 1");
    
    // Should include the last 5 messages
    expect(result).toContain("message 3");
    expect(result).toContain("message 4");
  });

  it("should handle workspace context with missing optional fields", () => {
    const workspaceContext: WorkspaceContext = {
      technologies: [],
      fileStructureSummary: "",
      recentFiles: [],
      // projectName is optional and missing
    };

    const params: EnrichmentPromptParams = {
      userPrompt: "test",
      intent: "implementation",
      mode: Mode.BUILD,
      workspaceContext,
    };

    const result = buildEnrichmentPrompt(params);

    // Should still include Project Context section
    expect(result).toContain("Project Context");
    // Should not crash or produce invalid output
    expect(result.length).toBeGreaterThan(0);
  });
});

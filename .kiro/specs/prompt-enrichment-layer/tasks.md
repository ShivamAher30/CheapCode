# Implementation Plan: Prompt Enrichment Layer

## Overview

This implementation plan breaks down the Prompt Enrichment Layer feature into discrete, actionable coding tasks. The enrichment layer will intercept user prompts, analyze them for context and clarity, and enhance them before passing to the main agent. The implementation is organized into phases: core infrastructure, context gathering, API endpoints, client integration, UI indicators, and testing.

## Tasks

- [x] 1. Create core enrichment infrastructure
  - [x] 1.1 Create enrichment service module with core types and functions
    - Create `packages/server/src/lib/enrichment.ts`
    - Define `EnrichmentOptions`, `EnrichmentResult`, and `EnrichmentError` types
    - Implement `enrichPrompt()` function with timeout handling using AbortController
    - Implement error handling and automatic fallback to original prompt
    - Add enrichment metrics tracking (tokens, duration, model used)
    - _Requirements: 1.1, 1.3, 5.1, 5.2, 8.1, 8.3_

  - [ ]* 1.2 Write unit tests for enrichment service
    - Test timeout handling with AbortController
    - Test error fallback behavior
    - Test enrichment result structure validation
    - _Requirements: 5.1, 5.2, 8.1_

  - [x] 1.3 Create prompt intent classification module
    - Create `packages/server/src/lib/enrichment-strategies.ts`
    - Define `PromptIntent` type ("question" | "implementation" | "debug" | "analysis" | "already_detailed")
    - Implement `classifyPromptIntent()` function with mode awareness
    - Implement `getEnrichmentStrategy()` function that returns strategy based on intent and mode
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

  - [ ]* 1.4 Write unit tests for intent classification
    - Test classification of questions vs implementations vs debug requests
    - Test "already_detailed" detection for long prompts (>300 chars)
    - Test mode-aware strategy selection (PLAN vs BUILD)
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [x] 2. Implement enrichment prompts and validation
  - [x] 2.1 Create enrichment prompt builder module
    - Create `packages/server/src/lib/enrichment-prompts.ts`
    - Define `EnrichmentPromptParams` type
    - Implement `buildEnrichmentPrompt()` function
    - Include intent-specific instructions for enrichment model
    - Add mode-aware guidance (PLAN: analysis only, BUILD: implementation)
    - Include workspace context and conversation history in prompt
    - _Requirements: 1.1, 1.2, 2.1, 2.2, 6.1, 6.2_

  - [x] 2.2 Create enrichment validation module
    - Create `packages/server/src/lib/enrichment-validator.ts`
    - Define `ValidationResult` type
    - Implement `validateEnrichedPrompt()` function
    - Add length check: reject if enriched > 3x original length
    - Add secret masking for API keys and tokens in logs
    - Add file path validation against workspace
    - _Requirements: 2.5, 7.4, 10.2_

  - [ ]* 2.3 Write unit tests for enrichment validation
    - Test length validation (reject > 3x)
    - Test API key masking in prompts and logs
    - Test file path validation
    - Test validation of malformed enriched output
    - _Requirements: 2.5, 7.4, 10.2_

- [ ] 3. Implement workspace context extraction
  - [x] 3.1 Create workspace context module
    - Create `packages/server/src/lib/workspace-context.ts`
    - Define `WorkspaceContext` type (technologies, fileStructureSummary, recentFiles, projectName)
    - Implement `getWorkspaceContext()` function
    - Extract technologies from package.json, dependencies, file extensions
    - Generate brief file structure summary
    - Track recently accessed/modified files
    - Add context caching to avoid repeated extraction
    - _Requirements: 2.1, 2.2, 2.3_

  - [ ]* 3.2 Write unit tests for workspace context extraction
    - Test technology detection from package.json
    - Test file structure summary generation
    - Test recent files tracking
    - Test context caching behavior
    - _Requirements: 2.1, 2.2_

- [x] 4. Create enrichment API endpoint
  - [x] 4.1 Create enrichment route module
    - Create `packages/server/src/routes/enrichment.ts`
    - Define POST /api/v1/enrichment/analyze endpoint
    - Define request schema with Zod (userPrompt, mode, workspaceId, enrichmentModel, includeHistory, groqApiKey)
    - Define response schema with Zod (enrichedPrompt, wasEnriched, enrichmentApplied, tokensUsed, durationMs)
    - Wire up enrichment service with workspace context
    - Implement request validation and error handling
    - Add enrichment metrics logging
    - _Requirements: 1.1, 1.3, 2.1, 3.1, 3.2, 7.1, 7.2_

  - [x] 4.2 Register enrichment endpoint in server
    - Import enrichment routes in `packages/server/src/index.ts`
    - Register /api/v1/enrichment route with Hono app
    - Ensure authentication/authorization applies to enrichment endpoint
    - _Requirements: 10.3_

  - [ ]* 4.3 Write integration tests for enrichment endpoint
    - Test successful enrichment flow end-to-end
    - Test workspace context integration with enrichment
    - Test custom enrichment model selection
    - Test request validation errors
    - _Requirements: 1.1, 2.1, 3.1_

- [ ] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Integrate enrichment into client chat hook
  - [x] 6.1 Modify use-chat hook to call enrichment endpoint
    - Modify `packages/cli/src/hooks/use-chat.ts`
    - Add `enrichmentEnabled` state with useState
    - Add `enrichmentFailures` state for consecutive failure tracking
    - Create `enrichAndSubmit()` function that calls enrichment endpoint before sending message
    - Implement fallback to original prompt on enrichment errors
    - Add `toggleEnrichment()` function to enable/disable enrichment
    - Track consecutive enrichment failures (disable after 3 failures)
    - Include enrichment metadata in message metadata (enrichmentApplied)
    - _Requirements: 1.1, 4.1, 4.2, 8.1, 8.2, 8.4, 8.5_

  - [ ]* 6.2 Write unit tests for client enrichment integration
    - Test enrichment call before message submission
    - Test fallback to original prompt on enrichment error
    - Test consecutive failure tracking and auto-disable
    - Test enrichment toggle functionality
    - _Requirements: 4.1, 8.1, 8.5_

- [ ] 7. Add enrichment UI indicators
  - [ ] 7.1 Add enrichment toggle control
    - Add enrichment toggle button/switch to status bar or command menu
    - Connect toggle to `toggleEnrichment()` from use-chat hook
    - Show current enrichment state (enabled/disabled)
    - _Requirements: 4.4_

  - [ ] 7.2 Add enrichment status indicators
    - Show visual indicator when prompt has been enriched (subtle badge or icon)
    - Add tooltip or expandable section to view enriched prompt alongside original
    - Show notification toast when enrichment is disabled due to failures
    - Display enrichment metadata (applied types, duration) in developer mode
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 7.3 Style enrichment UI components
    - Apply consistent styling to enrichment indicators
    - Ensure indicators are visible but not intrusive
    - Add appropriate colors/icons for enrichment states
    - _Requirements: 4.1, 4.2_

- [x] 8. Add configuration and environment variables
  - [x] 8.1 Add enrichment configuration to .env.example
    - Add `ENRICHMENT_ENABLED=true` (default)
    - Add `ENRICHMENT_MODEL=llama-3.1-8b-instant` (default fast Groq model)
    - Add `ENRICHMENT_TIMEOUT_MS=5000` (default timeout)
    - Add `ENRICHMENT_MAX_HISTORY_MESSAGES=5` (default history limit)
    - Document each variable with comments
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 5.1, 5.2_

  - [x] 8.2 Implement configuration loading in enrichment service
    - Load enrichment config from environment variables
    - Provide reasonable defaults if config not set
    - Support runtime overrides per enrichment request
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5_

- [x] 9. Implement mode-aware enrichment strategies
  - [x] 9.1 Create PLAN mode enrichment strategy
    - In enrichment prompt builder, add PLAN mode guidance
    - Focus on analysis, exploration, and read-only operations
    - Explicitly exclude file modification suggestions in PLAN mode
    - _Requirements: 6.1, 6.3_

  - [x] 9.2 Create BUILD mode enrichment strategy
    - In enrichment prompt builder, add BUILD mode guidance
    - Focus on implementation, modification, and write operations
    - Include suggestions for file operations and code changes
    - _Requirements: 6.2, 6.3_

  - [x] 9.3 Add mode conflict detection
    - Detect when user intent conflicts with current mode
    - Include mode switch suggestion in enriched prompt
    - _Requirements: 6.4_

  - [ ]* 9.4 Write unit tests for mode-aware enrichment
    - Test PLAN mode enrichment focuses on analysis
    - Test BUILD mode enrichment focuses on implementation
    - Test mode conflict detection and suggestions
    - _Requirements: 6.1, 6.2, 6.4_

- [ ] 10. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Add enrichment metrics and logging
  - [x] 11.1 Implement enrichment metrics tracking
    - Track enrichment success rate (enriched vs fallback)
    - Track enrichment latency (duration)
    - Track enrichment timeout rate
    - Track enrichment error rate by error type
    - Track token usage for enrichment
    - _Requirements: 7.1, 7.2_

  - [x] 11.2 Implement enrichment logging
    - Log all enrichment operations (original and enriched prompts)
    - Log enrichment failures with error details
    - Log timeout events
    - Mask secrets in logs (API keys, tokens)
    - _Requirements: 7.1, 10.2_

- [ ] 12. Implement conversation history integration
  - [ ] 12.1 Add conversation history to enrichment context
    - Retrieve recent conversation messages (configurable limit)
    - Include history in enrichment prompt for continuity
    - Limit history to most recent N messages to control context size
    - _Requirements: 2.2_

  - [ ]* 12.2 Write integration tests for history-aware enrichment
    - Test enrichment with conversation history
    - Test history limit enforcement
    - Test enrichment continuity across messages
    - _Requirements: 2.2_

- [ ] 13. Implement enrichment quality checks
  - [ ] 13.1 Add enrichment quality validation
    - Flag enrichments that exceed 3x original length for review
    - Validate intent preservation (no contradictions)
    - Check for hallucinated files or features
    - _Requirements: 1.6, 2.5, 7.4_

  - [ ] 13.2 Add enrichment comparison mechanism
    - Implement mechanism to compare agent responses with/without enrichment
    - Log comparison results for quality assessment
    - _Requirements: 7.3_

- [ ] 14. Implement file reference resolution
  - [ ] 14.1 Add file pattern resolution to enrichment
    - Detect file patterns in prompts (e.g., "the config file", "auth module")
    - Resolve patterns to specific file paths using workspace context
    - Include resolved paths in enriched prompt
    - Mark unresolved patterns as ambiguous
    - _Requirements: 2.3_

  - [ ]* 14.2 Write unit tests for file reference resolution
    - Test resolution of common file patterns
    - Test handling of ambiguous references
    - Test validation of resolved paths against workspace
    - _Requirements: 2.3, 2.5_

- [ ] 15. Implement technical term disambiguation
  - [ ] 15.1 Add technical term disambiguation to enrichment
    - Detect ambiguous technical terms in prompts
    - Use workspace technologies to disambiguate terms
    - Include clarified terms in enriched prompt
    - _Requirements: 1.2, 2.4_

  - [ ]* 15.2 Write unit tests for term disambiguation
    - Test disambiguation based on project technologies
    - Test handling of unambiguous terms
    - Test handling of unknown terms
    - _Requirements: 1.2, 2.4_

- [ ] 16. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Integration and polishing
  - [ ] 17.1 Test end-to-end enrichment flow
    - Test with simple prompts ("add login")
    - Test with questions ("how does auth work?")
    - Test with debug requests ("fix error in auth.ts")
    - Test with detailed prompts (should bypass enrichment)
    - Verify enrichment completes within timeout
    - Verify fallback works on errors
    - _Requirements: 1.1, 5.1, 8.1, 9.4_

  - [ ] 17.2 Test mode-aware enrichment
    - Test PLAN mode enrichment (analysis focus)
    - Test BUILD mode enrichment (implementation focus)
    - Verify mode-appropriate suggestions
    - _Requirements: 6.1, 6.2, 6.3_

  - [ ] 17.3 Test graceful degradation
    - Test fallback when enrichment model unavailable
    - Test fallback on timeout
    - Test auto-disable after 3 consecutive failures
    - Test manual toggle on/off
    - _Requirements: 3.5, 8.1, 8.4, 8.5_

  - [ ] 17.4 Test transparency and visibility
    - Verify enrichment indicators appear correctly
    - Verify user can view enriched vs original prompt
    - Verify enrichment metadata is visible
    - Verify notifications appear on failures
    - _Requirements: 4.1, 4.2, 4.3_

  - [ ] 17.5 Optimize enrichment performance
    - Profile enrichment latency
    - Optimize prompt construction for speed
    - Tune timeout thresholds based on testing
    - Optimize context extraction and caching
    - _Requirements: 5.1, 5.2, 5.3_

## Notes

- Tasks marked with `*` are optional testing tasks and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation throughout implementation
- The enrichment layer integrates with existing chat infrastructure without breaking changes
- Configuration allows users to balance cost vs quality vs speed
- Graceful fallback ensures system remains functional even when enrichment fails
- Mode-aware enrichment adapts to PLAN vs BUILD contexts
- Privacy and security are maintained through secret masking and secure API key handling

## Task Dependency Graph

```json
{
  "waves": [
    {
      "id": 0,
      "tasks": ["1.1", "1.3"]
    },
    {
      "id": 1,
      "tasks": ["1.2", "1.4", "2.1", "2.2", "3.1"]
    },
    {
      "id": 2,
      "tasks": ["2.3", "3.2", "4.1"]
    },
    {
      "id": 3,
      "tasks": ["4.2", "4.3"]
    },
    {
      "id": 4,
      "tasks": ["6.1", "8.1"]
    },
    {
      "id": 5,
      "tasks": ["6.2", "7.1", "8.2", "9.1", "9.2", "9.3", "11.1", "11.2", "12.1"]
    },
    {
      "id": 6,
      "tasks": ["7.2", "9.4", "12.2", "13.1", "14.1"]
    },
    {
      "id": 7,
      "tasks": ["7.3", "13.2", "14.2", "15.1"]
    },
    {
      "id": 8,
      "tasks": ["15.2", "17.1", "17.2"]
    },
    {
      "id": 9,
      "tasks": ["17.3", "17.4", "17.5"]
    }
  ]
}
```

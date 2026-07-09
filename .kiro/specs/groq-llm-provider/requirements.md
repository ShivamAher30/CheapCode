# Requirements Document

## Introduction

This document specifies the requirements for adding Groq as a new LLM provider to the CheapCode CLI chat application. Groq offers fast inference with competitive pricing for models like Llama and Mixtral. Users will be able to configure their Groq API key and select from available Groq models to use in chat interactions, similar to the existing Anthropic, OpenAI, and Ollama provider integrations.

## Glossary

- **CheapCode**: The CLI chat application system
- **Groq_Provider**: The new Groq LLM provider integration module
- **Model_Registry**: The shared model definitions registry in @localcode/shared
- **Model_Resolver**: The server-side model resolution system that instantiates provider clients
- **API_Key**: The Groq API authentication key provided by users
- **Environment_Config**: The .env file containing provider API keys and configuration
- **Supported_Model**: A model definition in the Model_Registry with provider, ID, and pricing information
- **Provider_SDK**: The @ai-sdk/groq npm package for Groq integration
- **Model_Dialog**: The CLI UI component for selecting chat models

## Requirements

### Requirement 1: Groq Provider SDK Integration

**User Story:** As a developer, I want the Groq provider SDK integrated into the codebase, so that the application can communicate with Groq's API.

#### Acceptance Criteria

1. THE CheapCode SHALL include the @ai-sdk/groq package as a dependency in the server package
2. WHEN the server package is installed, THE CheapCode SHALL have access to the Groq SDK functions
3. THE Groq_Provider SHALL be initialized using the Groq API key from Environment_Config
4. THE Groq_Provider SHALL support creating language model instances for Groq model IDs

### Requirement 2: Environment Configuration Support

**User Story:** As a user, I want to configure my Groq API key in the environment file, so that the application can authenticate with Groq's API.

#### Acceptance Criteria

1. THE Environment_Config SHALL support a GROQ_API_KEY variable
2. THE .env.example file SHALL document the GROQ_API_KEY variable with appropriate comments
3. WHEN GROQ_API_KEY is set, THE Groq_Provider SHALL use it for API authentication
4. WHEN GROQ_API_KEY is not set, THE CheapCode SHALL function normally with other providers

### Requirement 3: Model Registry Integration

**User Story:** As a user, I want Groq models to appear in the model selection interface, so that I can choose from available Groq models.

#### Acceptance Criteria

1. THE Model_Registry SHALL include "groq" as a Supported_Provider type
2. THE Model_Registry SHALL define at least three Groq models with accurate pricing information
3. FOR ALL Groq models in Model_Registry, THE model definition SHALL include an id, provider set to "groq", and pricing with inputUsdPerMillionTokens and outputUsdPerMillionTokens
4. THE Model_Registry SHALL include popular Groq models such as llama-3.3-70b-versatile, llama-3.1-8b-instant, and mixtral-8x7b-32768
5. FOR ALL Groq model IDs, THE id SHALL match the exact model identifier used by Groq's API

### Requirement 4: Model Resolution

**User Story:** As a developer, I want the model resolver to support Groq models, so that chat requests can use Groq models.

#### Acceptance Criteria

1. WHEN a Groq model ID is provided to Model_Resolver, THE Model_Resolver SHALL return a ResolvedModel with the Groq language model instance
2. THE Model_Resolver SHALL handle the "groq" provider case in the model resolution logic
3. WHEN resolving a Groq model, THE Model_Resolver SHALL create a Groq client instance using the Groq SDK
4. THE Model_Resolver SHALL set the provider field to "groq" in the returned ResolvedModel

### Requirement 5: Chat Conversation Support

**User Story:** As a user, I want to use Groq models in chat conversations, so that I can leverage Groq's fast inference.

#### Acceptance Criteria

1. WHEN a user selects a Groq model in Model_Dialog, THE CheapCode SHALL use the selected Groq model for subsequent chat messages
2. WHEN a chat message is submitted with a Groq model selected, THE CheapCode SHALL stream responses from the Groq API
3. WHEN a Groq model chat completes, THE CheapCode SHALL track usage statistics including prompt tokens and completion tokens
4. WHEN a Groq API error occurs, THE CheapCode SHALL display an appropriate error message to the user

### Requirement 6: Usage Tracking and Billing

**User Story:** As a user, I want Groq usage to be tracked for billing purposes, so that I am charged correctly for Groq API usage.

#### Acceptance Criteria

1. WHEN a Groq chat conversation completes, THE CheapCode SHALL calculate credits based on the Groq model's pricing and actual token usage
2. THE CheapCode SHALL use the inputUsdPerMillionTokens and outputUsdPerMillionTokens values from the Groq model's pricing definition
3. WHEN calculating credits for Groq usage, THE CheapCode SHALL apply the same credit calculation formula used for other providers
4. WHEN ingesting usage to the billing system, THE CheapCode SHALL include the Groq provider and model information

### Requirement 7: Model Availability Validation

**User Story:** As a developer, I want the system to validate Groq model IDs, so that only supported Groq models can be used.

#### Acceptance Criteria

1. WHEN a model ID is validated, THE CheapCode SHALL check if it exists in the Model_Registry
2. WHEN an unsupported Groq model ID is provided, THE Model_Resolver SHALL throw an error with message "Unsupported model: {modelId}"
3. THE CheapCode SHALL accept any Groq model ID that is defined in the Model_Registry
4. THE model validation logic SHALL work consistently for Groq models as it does for existing providers

# CheapCode

CheapCode is a professional terminal-based AI coding assistant designed to work with local AI models through Ollama, enabling cost-effective development without reliance on cloud APIs. It features conversational code generation, workspace persistence, and an autonomous multi-step agent mode with plan validation and auto-repair.

## System Architecture

The project is structured as a monorepo utilizing Bun workspaces:

```
cheapcode/
├── packages/
│   ├── cli/              Terminal User Interface (TUI) application built with React and OpenTUI
│   ├── server/           Hono-based API server orchestrating AI stream responses and agent execution
│   ├── database/         Prisma schema and client configuration for PostgreSQL persistence
│   └── shared/           Shared TypeScript types, model definitions, and utility schemas
```

### Monorepo Components

*   **CLI (packages/cli)**: Interacts with the local API server using Hono's RPC client (`hc`). It renders terminal components in a high-fidelity rendering loop (up to 60 FPS) and handles interactive commands, file mention autocompletion (`@` queries), and model state.
*   **Server (packages/server)**: Exposes endpoints for session/workspace management, prompt enrichment, and conversational streams. It coordinates the execution of local system tools (file reading, writing, terminal command execution, and search) requested by the LLM.
*   **Database (packages/database)**: Manages local database structure and history records using PostgreSQL and Prisma ORM.
*   **Shared (packages/shared)**: Contains system schemas (such as the operation mode schema) and the registry of supported AI models.

## Core Features

*   **Local-First Execution**: Integrates directly with Ollama to run models (such as Llama 3.2, Mistral, CodeLlama, Qwen 2.5 Coder, and DeepSeek Coder) locally with zero API costs.
*   **Remote Ollama Integration**: Supports connecting to remote Ollama servers running on other machines in the local network via `/ollama` command. The server dynamically routes requests to the custom endpoint.
*   **Autonomous Agent Mode**: Translates user goals into execution plans, carries out multi-step file operations, automatically validates code through tests/builds, and auto-repairs errors.
*   **Bring Your Own Key (BYOK) for Groq**: Support for API keys configured at runtime to query hosted Groq models (Llama 3.3, Mixtral, Gemma 2).
*   **Operating Modes**:
    *   **PLAN**: Read-only workspace analysis, code exploration, and diagnostic operations.
    *   **BUILD**: Immediate code generation and file modifications.
    *   **AGENT**: Full multi-step autonomous execution mode.
*   **Prompt Enrichment**: Classifies intent and enriches user instructions with workspace metadata, recent files, and technology stack context before submitting to the model.

## Prerequisites

Ensure you have the following installed on your system:
*   [Bun](https://bun.sh) runtime (v1.0 or later)
*   [Ollama](https://ollama.ai) for local model execution
*   PostgreSQL database instance

## Installation and Configuration

### 1. Install Dependencies
Clone the repository and install packages using Bun:
```bash
git clone <repository-url>
cd CheapCode
bun install
```

### 2. Configure Environment Variables
Copy the sample environment file to the project root:
```bash
cp .env.example .env
```
Edit the `.env` file to configure your credentials:
```env
# Database Connection (PostgreSQL)
DATABASE_URL=postgresql://user:password@localhost:5432/cheapcode

# Ollama Endpoint Configuration
OLLAMA_BASE_URL=http://localhost:11434/api

# Optional: Cloud Provider API Keys
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key
GROQ_API_KEY=your_optional_server_groq_key
```

### 3. Initialize the Database
Generate the Prisma client and run database migrations:
```bash
cd packages/database
bunx prisma migrate dev
cd ../..
```

### 4. Setup Ollama Models
Ensure the Ollama service is active and pull the required models:
```bash
ollama pull llama3.2
ollama pull codellama
ollama pull qwen2.5-coder
```

## Running the Application

### Development Mode
Run the backend server and frontend CLI in separate terminal windows:

**Terminal 1 (Backend API Server):**
```bash
bun run dev:server
```

**Terminal 2 (CLI Terminal Interface):**
```bash
bun run dev:cli
```

### Production Build and Global Linking
To bundle the application and run CheapCode globally on your system:
```bash
# Build the self-contained package and link globally
bun run link:cli

# Run CheapCode from any workspace directory
cheapcode
```

## CLI Commands

You can enter the following commands in the CLI input bar:

*   `/new`: Starts a new workspace conversation.
*   `/agents`: Opens the agent selection menu to switch modes.
*   `/models`: Opens a model selection menu to change the active model.
*   `/groq`: Sets a temporary Groq API key and changes the active model to a Groq model.
*   `/ollama`: Configures a custom Ollama base URL (e.g. for remote local network servers) and selects a local model.
*   `/workspaces`: Opens a workspace dialog to search and resume past coding sessions.
*   `/theme`: Changes the terminal UI color theme.
*   `/exit`: Safely terminates the CLI process.

## Technology Stack

*   **Runtime Environment**: Bun
*   **TUI Rendering Engine**: OpenTUI (React integration for terminal interfaces)
*   **Web Framework**: Hono (handles HMR server-side routes and RPC interfaces)
*   **ORM and Database**: Prisma with PostgreSQL
*   **Inference Engine**: Vercel AI SDK
*   **AI Backend**: Ollama (local/network), Groq (cloud BYOK), OpenAI (cloud), Anthropic (cloud)

## Troubleshooting

### Workspace package not resolved ('@localcode/shared')
Ensure you run `bun install` from the root directory rather than within individual subfolders. This allows Bun to properly establish monorepo symlinks between packages.

### Ollama fails to connect
Verify that the Ollama service is active by running `ollama list`. If you are connecting to a remote Ollama server, ensure the remote host is running with `OLLAMA_HOST=0.0.0.0` and that port `11434` is open in the remote system's firewall.

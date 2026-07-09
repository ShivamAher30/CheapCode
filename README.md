# CheapCode

A professional terminal-based AI coding assistant designed to work with local AI models through Ollama, enabling cost-effective development without reliance on expensive cloud APIs.

**🆕 NEW: Autonomous Agent Mode with explicit planning, automatic verification, and error recovery!**

## Overview

CheapCode provides a powerful command-line interface for interacting with AI models to assist with coding tasks. The primary goal is to enable developers to leverage advanced AI capabilities using local models via Ollama, eliminating API costs while maintaining privacy and control over their development environment.

### What's New: Agent Mode 🤖

We've added an **autonomous agent system** that transforms CheapCode into a sophisticated multi-step assistant:

- **📋 Explicit Planning** - Creates structured task lists before execution
- **🔄 Multi-Step Execution** - Breaks complex goals into manageable tasks
- **✅ Automatic Verification** - Runs tests and builds automatically
- **🔧 Error Recovery** - Auto-repairs failed verifications
- **📊 Progress Tracking** - Real-time updates on execution
- **🎯 Task Dependencies** - Smart task ordering and blocking

[Learn more about Agent Mode →](./AGENT_QUICK_START.md)

### Screenshots

#### Main Interface
![Main Interface](./assets/Screenshot%202026-06-18%20123512.png)
*Clean terminal interface for conversational AI coding assistance*

#### Command Menu
![Command Menu](./assets/Screenshot%202026-06-18%20125136.png)
*Quick access to workspaces, models, themes, and account features*

#### Model Selection
![Model Selection](./assets/Screenshot%202026-06-18%20125902.png)
*Choose from local Ollama models or cloud providers (Claude, GPT)*

### Key Features

- **Local-First Architecture**: Run AI models locally using Ollama (Llama, Mistral, CodeLlama, and more)
- **Autonomous Agent Mode**: Multi-step planning with automatic verification and repair
- **Cloud AI Optional**: Support for Anthropic Claude and OpenAI GPT models when needed
- **Terminal User Interface**: Clean, efficient TUI built with React and OpenTUI
- **Workspace Management**: Organize and manage multiple coding sessions
- **Three Operating Modes**:
  - **PLAN** - Read-only analysis and exploration
  - **BUILD** - Direct implementation with immediate execution
  - **AGENT** - Autonomous multi-step execution with planning
- **Conversational Interface**: Natural language interaction for coding assistance
- **High Performance**: Built on Bun runtime for optimal speed
- **Secure Authentication**: OAuth integration via Clerk

## Architecture

The project is structured as a monorepo with the following packages:

```
cheapcode/
├── packages/
│   ├── cli/              Terminal UI application
│   ├── server/           Hono-based API server
│   ├── database/         Prisma schema and database client
│   └── shared/           Shared types and utilities
```

## Prerequisites

Before installing CheapCode, ensure you have the following:

- [Bun](https://bun.sh) runtime (v1.0+)
- [Ollama](https://ollama.ai) for local AI model execution
- PostgreSQL database (local instance, Neon, Supabase, or similar)
- Optional: API keys for Anthropic Claude or OpenAI GPT (if using cloud models)

## Installation

### 1. Clone and Install Dependencies

```bash
git clone <repository-url>
cd CheapCode
bun install
```

### 2. Configure Ollama

Install Ollama from [ollama.ai](https://ollama.ai) and download your preferred models:

```bash
# Pull recommended models for coding
ollama pull llama3.2
ollama pull codellama
ollama pull qwen2.5-coder

# Or pull other available models
ollama pull mistral
ollama pull deepseek-coder
```

### 3. Database Setup

Copy the example environment file and configure your database:

```bash
cp .env.example .env
```

Edit `.env` with your database credentials:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/cheapcode
```

Run database migrations:

```bash
cd packages/database
bunx prisma migrate dev
cd ../..
```

### 4. Environment Configuration

Configure additional environment variables in `.env`:

```env
# Ollama Configuration (required for local models)
OLLAMA_BASE_URL=http://localhost:11434/api

# Optional: Cloud AI Providers
ANTHROPIC_API_KEY=your_anthropic_key
OPENAI_API_KEY=your_openai_key

# Optional: Authentication (Clerk)
CLERK_SECRET_KEY=your_clerk_secret
CLERK_PUBLISHABLE_KEY=your_clerk_publishable_key
```

## Usage

### Development Mode

Start the server and CLI in separate terminal sessions:

**Terminal 1 - API Server:**
```bash
bun run dev:server
```

**Terminal 2 - CLI Interface:**
```bash
bun run dev:cli
```

### Production Build

Build and link the CLI globally:

```bash
bun run link:cli
cheapcode
```

## Available AI Models

### Local Models (via Ollama)

Running models locally through Ollama provides zero-cost AI assistance:

| Model | Description | Use Case |
|-------|-------------|----------|
| `llama3.2` | Meta's latest Llama | General purpose, good balance |
| `codellama` | Code-specialized Llama | Code generation and analysis |
| `qwen2.5-coder` | Qwen coding model | Fast, efficient coding tasks |
| `deepseek-coder` | DeepSeek coding model | Advanced code understanding |
| `mistral` | Mistral AI model | Fast general-purpose assistant |

### Cloud Models (Optional)

Cloud models require API keys and incur usage costs:

- **Anthropic Claude**: Sonnet 4.6, Haiku 4.5, Opus 4.6
- **OpenAI GPT**: GPT-5.4, GPT-5.4-mini, GPT-5.4-nano

## API Endpoints

The server exposes RESTful endpoints at `/api/v1/`:

```
/api/v1/
├── authentication/
│   ├── login
│   ├── callback
│   └── logout
├── workspaces/
│   ├── list
│   ├── create
│   └── :id
└── conversations/
    └── stream
```

## Development Commands

| Command | Description |
|---------|-------------|
| `bun install` | Install all dependencies |
| `bun run dev:server` | Start server with hot reload |
| `bun run dev:cli` | Start CLI with watch mode |
| `bun run build:cli` | Build CLI for production |
| `bun run link:cli` | Link CLI globally after build |

## Technology Stack

- **Runtime**: Bun
- **Frontend**: React with OpenTUI for terminal rendering
- **Backend**: Hono (lightweight HTTP framework)
- **Database**: PostgreSQL with Prisma ORM
- **AI Integration**: Vercel AI SDK
- **AI Providers**: Ollama (local), Anthropic Claude, OpenAI GPT
- **Authentication**: Clerk OAuth

## Configuration

### Changing Ollama Server

If running Ollama on a different host or port:

```env
OLLAMA_BASE_URL=http://your-server:11434/api
```

### Selecting Default Model

The default model is `llama3.2`. To change it, modify `DEFAULT_CHAT_MODEL_ID` in `packages/shared/src/models.ts`.

### Model Selection in CLI

Press Tab in the CLI to open the model selection menu and choose from available local or cloud models.

## Troubleshooting

### ENOENT: Cannot find '@localcode/shared'

This error indicates missing workspace dependencies. Run:

```bash
bun install
```

This will properly link workspace packages and resolve the dependency.

### Ollama Connection Issues

Ensure Ollama is running:

```bash
ollama serve
```

Verify models are available:

```bash
ollama list
```

### Database Connection Errors

Verify your `DATABASE_URL` in `.env` is correct and the database is accessible. Test with:

```bash
cd packages/database
bunx prisma db push
```

## Contributing

Contributions are welcome. Please follow these guidelines:

1. Fork the repository
2. Create a feature branch
3. Make your changes with clear commit messages
4. Submit a pull request with a detailed description

## Documentation

- **[Quick Start Guide](./AGENT_QUICK_START.md)** - Get started with Agent Mode in 5 minutes
- **[Architecture Overview](./AGENT_ARCHITECTURE.md)** - System design and technical details
- **[Migration Guide](./AGENT_MIGRATION_GUIDE.md)** - Comprehensive usage guide
- **[Agent Technical Docs](./packages/server/src/agent/README.md)** - Deep dive into the agent system
- **[Implementation Summary](./IMPLEMENTATION_SUMMARY.md)** - What was built and why

## License

MIT License - see LICENSE file for details

## Support

For issues, questions, or contributions, please visit the project repository.

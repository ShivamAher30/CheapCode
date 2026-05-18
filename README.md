# CheapCode

<div align="center">

<h1>CheapCode</h1>

<p>A powerful terminal-based AI coding assistant with local model support - code for cheap (or free!)</p>

<br />

<p>
  <a href="#"><img src="https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white" alt="Bun" /></a>&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/OpenTUI-111111?style=for-the-badge" alt="OpenTUI" /></a>&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB" alt="React" /></a>&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/Hono-E36002?style=for-the-badge&logo=hono&logoColor=white" alt="Hono" /></a>&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/Ollama-000000?style=for-the-badge" alt="Ollama" /></a>&nbsp;
  <a href="#"><img src="https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white" alt="PostgreSQL" /></a>
</p>

</div>

## Features

- 🚀 **Terminal-first Interface** - Beautiful TUI built with React and OpenTUI
- 🤖 **Local AI Models** - Run Llama, Mistral, CodeLlama and more via Ollama
- ☁️ **Cloud AI Support** - Optional Claude and GPT integration
- 💬 **Interactive Conversations** - Natural chat interface for coding tasks
- 🔧 **Smart Workspaces** - Organize your coding sessions
- ⚡ **Fast & Lightweight** - Built with Bun for maximum performance
- 🔐 **Secure Authentication** - Clerk-based OAuth flow

## Quick Start

### Prerequisites

- [Bun](https://bun.sh) installed
- [Ollama](https://ollama.ai) installed (for local models)
- PostgreSQL database (e.g., Neon, Supabase, or local)
- Optional: Anthropic or OpenAI API keys for cloud models

### 1. Install Dependencies

```bash
git clone <your-repo-url>
cd cheapcode
bun install
```

### 2. Set Up Ollama

Install and start Ollama:

```bash
# Install Ollama from https://ollama.ai

# Pull your preferred model
ollama pull llama3.2
ollama pull codellama
ollama pull mistral
```

### 3. Configure Environment

Copy `.env.example` to `.env` and configure:

```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/cheapcode

# Ollama (default local setup)
OLLAMA_BASE_URL=http://localhost:11434/api

# Optional: Cloud AI providers
ANTHROPIC_API_KEY=your_key_here
OPENAI_API_KEY=your_key_here

# Authentication (optional for local dev)
CLERK_SECRET_KEY=your_key_here
# ... other Clerk vars
```

### 4. Run Database Migrations

```bash
cd packages/database
bunx prisma migrate dev
```

### 5. Start the Application

Terminal 1 - Start the server:
```bash
bun run dev:server
```

Terminal 2 - Start the CLI:
```bash
bun run dev:cli
```

Or link and use globally:
```bash
bun run link:cli
cheapcode
```

## Architecture

```
cheapcode/
├── packages/
│   ├── cli/              # Terminal UI application
│   ├── server/           # Hono API server
│   ├── database/         # Prisma schema and client
│   └── shared/           # Shared types and utilities
```

## Available Models

### Local Models (via Ollama) - 100% FREE! 🎉
- `llama3.2` - Meta's latest Llama model (default, great balance)
- `codellama` - Specialized for code generation
- `qwen2.5-coder` - Excellent coding model with fast performance
- `deepseek-coder` - Another great coding option
- `mistral` - Fast and efficient general purpose

**Note**: Local models run on your machine, require no API keys, and cost nothing! Just install Ollama and pull the models you want.

### Cloud Models (optional, requires API keys)
- **Claude** (Sonnet 4.6, Haiku 4.5, Opus 4.6) - Best quality, costs $$$
- **GPT** (5.4, 5.4-mini, 5.4-nano) - Good quality, moderate cost

## API Structure

The server exposes a REST API at `/api/v1/`:

```
/api/v1/
├── authentication/
│   ├── login
│   ├── callback
│   └── logout
├── payments/          (optional)
│   ├── checkout
│   └── portal
├── workspaces/
│   ├── list
│   ├── create
│   └── :id
└── conversations/
    └── stream
```

## Development

```bash
# Install dependencies
bun install

# Run database migrations
cd packages/database && bunx prisma migrate dev

# Start server (hot reload)
bun run dev:server

# Start CLI (watch mode)
bun run dev:cli

# Build CLI for production
bun run build:cli

# Link CLI globally
bun run link:cli
```

## Configuration

### Ollama Configuration

By default, CheapCode connects to Ollama at `http://localhost:11434/api`. You can change this:

```env
OLLAMA_BASE_URL=http://your-ollama-server:11434/api
```

### Switching to Local Models

To use free local models:
1. Install Ollama from https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. In the CLI, press Tab to open the models menu
4. Search for "local" or the specific model name
5. Select your preferred Ollama model (marked with [Local])

No API keys needed!

```env
OLLAMA_BASE_URL=http://your-ollama-server:11434/api
```

### Model Selection

The default model is `llama3.2`. You can change this in the UI or by modifying `DEFAULT_CHAT_MODEL_ID` in `packages/shared/src/models.ts`.

## Project Structure

| Package | Description |
|---------|-------------|
| `@localcode/cli` | Terminal UI built with React & OpenTUI |
| `@localcode/server` | Hono HTTP server with AI streaming |
| `@localcode/database` | Prisma schema and database client |
| `@localcode/shared` | Shared types, schemas, and utilities |

## Tech Stack

- **Runtime**: Bun
- **UI**: React + OpenTUI (terminal rendering)
- **Server**: Hono (lightweight HTTP framework)
- **Database**: PostgreSQL with Prisma ORM
- **AI**: Vercel AI SDK with Ollama, Anthropic, OpenAI
- **Auth**: Clerk OAuth

## License

MIT

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

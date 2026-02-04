# Claudette

An OpenAI-compatible proxy that uses Claude Code's OAuth authentication.

## Prerequisites

You must be authenticated with Claude Code:

```bash
claude login
```

## Quick Start

```bash
make setup
```

This will:
1. Generate a local API key
2. Build the Docker container
3. Start the proxy

## Usage

### With OpenAI Python Client

```python
from openai import OpenAI

client = OpenAI(
    api_key="your-api-key-from-.env",
    base_url="http://localhost:5766/v1"
)

response = client.chat.completions.create(
    model="sonnet",  # or "opus", "haiku"
    messages=[{"role": "user", "content": "Hello!"}],
    stream=True
)

for chunk in response:
    print(chunk.choices[0].delta.content, end="")
```

### With curl

```bash
curl http://localhost:5766/v1/chat/completions \
  -H "Authorization: Bearer $(grep API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"sonnet","messages":[{"role":"user","content":"Hello!"}]}'
```

## Commands

| Command | Description |
|---------|-------------|
| `make local-start` | Start proxy locally (recommended) |
| `make local-stop` | Stop local proxy |
| `make local-status` | Check if proxy is running |
| `make local-logs` | View proxy logs |
| `make test` | Test with a sample request |
| `make dev` | Run locally with hot reload |
| `make start` | Start with Docker |
| `make stop` | Stop Docker container |
| `make setup` | Docker: build and start |
| `make clean` | Remove containers and credentials |

## Model Mappings

| Model | Claude Model |
|-------|--------------|
| `sonnet` | sonnet (default) |
| `opus` | opus |
| `haiku` | haiku |
| `gpt-4` | opus |
| `gpt-4o` | sonnet |
| `gpt-3.5-turbo` | haiku |

## Architecture

```
[Your App] --API-key--> [Proxy :5766] --spawns--> [Claude CLI] --OAuth--> [Anthropic]
                              |
                    [~/.claude/.credentials.json] (read-only)
```

## Security

- Container only accessible from localhost (127.0.0.1)
- OAuth credentials are read-only (never modified)
- Local API key required for all requests
- Spawns the official Claude Code CLI for requests

## Files

- `src/server.ts` - Express server with OpenAI-compatible endpoints
- `src/claude.ts` - Spawns Claude CLI for requests
- `src/auth.ts` - OAuth token reader (read-only)
- `Dockerfile` - Container build
- `docker-compose.yml` - Container config
- `Makefile` - Commands

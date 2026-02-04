# Claude Proxy

An OpenAI-compatible API proxy that lets you use Claude through your Claude Code (Max/Pro) subscription.

```
┌─────────────────┐         ┌─────────────────┐         ┌─────────────────┐
│                 │   HTTP  │                 │  OAuth  │                 │
│   Open WebUI    │────────▶│  Claude Proxy   │────────▶│   Anthropic     │
│   or any app    │◀────────│  (localhost)    │◀────────│   API           │
│                 │   JSON  │                 │         │                 │
└─────────────────┘         └─────────────────┘         └─────────────────┘
                                    │
                                    │ reads
                                    ▼
                            ~/.claude/.credentials.json
                            (from `claude login`)
```

## Why?

- **Use Claude in any OpenAI-compatible app** (Open WebUI, Continue, etc.)
- **No API key needed** - uses your existing Claude Code subscription
- **Local only** - proxy runs on localhost, credentials never leave your machine

## Quick Start

```bash
# 1. Make sure you're logged into Claude Code
claude login

# 2. Clone and start
git clone <repo>
cd claudette
make local-start

# 3. Use with any OpenAI-compatible client
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer $(grep API_KEY .env | cut -d= -f2)" \
  -H "Content-Type: application/json" \
  -d '{"model":"sonnet","messages":[{"role":"user","content":"Hello!"}]}'
```

## How It Works

```
┌────────────────────────────────────────────────────────────────────────┐
│                           Request Flow                                  │
└────────────────────────────────────────────────────────────────────────┘

  Client Request                 Proxy                      Claude CLI
       │                          │                             │
       │  POST /v1/chat/         │                             │
       │  completions            │                             │
       │  ───────────────────▶   │                             │
       │                          │                             │
       │                          │  spawn `claude`            │
       │                          │  with prompt via stdin     │
       │                          │  ─────────────────────────▶│
       │                          │                             │
       │                          │                             │ Uses OAuth
       │                          │                             │ token from
       │                          │                             │ ~/.claude/
       │                          │                             │
       │                          │  stdout (response)         │
       │                          │◀───────────────────────────│
       │                          │                             │
       │  OpenAI-format JSON     │                             │
       │◀─────────────────────   │                             │
       │                          │                             │
```

### Authentication Flow

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1. You run `claude login` (one time)                              │
│     └──▶ OAuth flow with Anthropic                                 │
│          └──▶ Tokens saved to ~/.claude/.credentials.json          │
│                                                                     │
│  2. Proxy reads token from credentials file (read-only)            │
│     └──▶ Never modifies your Claude config                         │
│                                                                     │
│  3. Proxy spawns `claude` CLI for each request                     │
│     └──▶ CLI uses the OAuth token automatically                    │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/v1/models` | GET | List available models |
| `/v1/chat/completions` | POST | Chat completion (OpenAI-compatible) |

### Example Request

```bash
curl http://localhost:8000/v1/chat/completions \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "sonnet",
    "messages": [
      {"role": "system", "content": "You are helpful."},
      {"role": "user", "content": "Hello!"}
    ],
    "stream": false
  }'
```

### Example Response

```json
{
  "id": "chatcmpl-1234567890-abc",
  "object": "chat.completion",
  "created": 1234567890,
  "model": "sonnet",
  "choices": [{
    "index": 0,
    "message": {
      "role": "assistant",
      "content": "Hello! How can I help you today?"
    },
    "finish_reason": "stop"
  }],
  "usage": {
    "prompt_tokens": 15,
    "completion_tokens": 9,
    "total_tokens": 24
  }
}
```

## Models

| Model ID | Maps To | Best For |
|----------|---------|----------|
| `sonnet` | Claude Sonnet 4 | Balanced performance (default) |
| `opus` | Claude Opus 4 | Complex reasoning |
| `haiku` | Claude Haiku 3.5 | Fast responses |
| `gpt-4` | opus | OpenAI compatibility |
| `gpt-4o` | sonnet | OpenAI compatibility |
| `gpt-3.5-turbo` | haiku | OpenAI compatibility |

## Commands

```
make local-start    # Start proxy locally (recommended)
make local-stop     # Stop local proxy
make local-status   # Check status
make local-logs     # View logs
make test           # Test the proxy
make dev            # Development mode (hot reload)

# Docker (alternative)
make start          # Start with Docker
make stop           # Stop Docker container
make logs           # View Docker logs
```

## Using with Open WebUI

See [OPENWEBUI.md](OPENWEBUI.md) for detailed setup instructions.

Quick version:
1. `make local-start`
2. In Open WebUI: Settings → Connections → OpenAI API
3. Set URL: `http://localhost:8000/v1` (or `http://host.docker.internal:8000/v1` if Open WebUI is in Docker)
4. Set API Key: value from `.env` file

## Project Structure

```
claudette/
├── src/
│   ├── server.ts      # Express server, OpenAI-compatible endpoints
│   ├── claude.ts      # Spawns Claude CLI, handles responses
│   └── auth.ts        # Reads OAuth token from credentials
├── Dockerfile         # Docker build configuration
├── docker-compose.yml # Docker orchestration
├── Makefile           # Build and run commands
├── package.json
├── tsconfig.json
├── .env               # Generated API key (gitignored)
├── OPENWEBUI.md       # Open WebUI setup guide
└── README.md
```

## Security

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Security Model                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ✓ Localhost only        Proxy binds to 127.0.0.1                  │
│  ✓ Read-only access      Never writes to ~/.claude/                │
│  ✓ Local API key         Requests require key from .env            │
│  ✓ No credential storage OAuth tokens stay in Claude's config      │
│  ✓ Official CLI          Uses `claude` binary, not reverse-eng'd   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## Troubleshooting

### "OAuth token not found"
```bash
claude login  # Re-authenticate with Claude Code
```

### "Connection refused"
```bash
make local-status  # Check if proxy is running
make local-start   # Start if not running
```

### Slow responses
The first request may be slow as the Claude CLI initializes. Subsequent requests are faster.

### View detailed logs
```bash
make local-logs
# or
tail -f proxy.log
```

## Requirements

- Node.js 18+
- Claude Code CLI (`claude`) installed and authenticated
- Claude Code subscription (Max or Pro)

## License

MIT

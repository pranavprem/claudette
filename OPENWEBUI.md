# Setting up Open WebUI with Claudette

This guide shows how to connect Open WebUI to Claude using this local proxy.

## Prerequisites

1. Claude Code authenticated: `claude login`
2. Node.js 18+ installed
3. Open WebUI running (see below)

## Step 1: Start the Proxy

```bash
cd /path/to/claudette
make local-start
```

This starts the proxy at `http://localhost:5766`.

Verify it's running:
```bash
curl http://localhost:5766/health
```

## Step 2: Get Your API Key

```bash
cat .env
# Output: API_KEY=sk-local-xxxx
```

## Step 3: Install Open WebUI

If you don't have Open WebUI running:

```bash
# Using Docker
docker run -d -p 3000:8080 \
  --name open-webui \
  --restart always \
  ghcr.io/open-webui/open-webui:main
```

Open http://localhost:3000 and create an account.

## Step 4: Configure Open WebUI

1. Go to **Settings** (gear icon) → **Admin Settings** → **Connections**

2. Under **OpenAI API**, configure:
   - **API Base URL**: `http://host.docker.internal:5766/v1`
     - If Open WebUI is running natively (not Docker): `http://localhost:5766/v1`
   - **API Key**: Your key from `.env` (e.g., `sk-local-22c72fe427a6e001...`)

3. Click **Save**

4. Go to **Settings** → **Models** and click refresh to load available models

## Step 5: Start Chatting

1. Click **New Chat**
2. Select a model (e.g., `sonnet`, `opus`, `haiku`)
3. Start chatting with Claude!

## Available Models

| Model ID | Description |
|----------|-------------|
| `sonnet` | Claude Sonnet 4 (balanced) |
| `opus` | Claude Opus 4 (most capable) |
| `haiku` | Claude Haiku 3.5 (fastest) |

## Troubleshooting

### "Connection refused" in Open WebUI

If Open WebUI runs in Docker, use `host.docker.internal` instead of `localhost`:
```
http://host.docker.internal:5766/v1
```

On Linux, you may need to add `--add-host=host.docker.internal:host-gateway` to the Docker run command:
```bash
docker run -d -p 3000:8080 \
  --add-host=host.docker.internal:host-gateway \
  --name open-webui \
  ghcr.io/open-webui/open-webui:main
```

### "Invalid API key"

Make sure you're using the full API key from `.env`, including the `sk-local-` prefix.

### Proxy not responding

Check if the proxy is running:
```bash
make local-status
```

Restart if needed:
```bash
make local-stop
make local-start
```

### View proxy logs

The proxy logs to stdout. If you started with `make local-start`, logs go to `proxy.log`:
```bash
tail -f proxy.log
```

## Commands Reference

| Command | Description |
|---------|-------------|
| `make local-start` | Start proxy locally (background) |
| `make local-stop` | Stop local proxy |
| `make local-status` | Check if proxy is running |
| `make local-logs` | View proxy logs |

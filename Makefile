.PHONY: setup start stop logs clean test build

# Build and start
setup: .env build start
	@echo ""
	@echo "=========================================="
	@echo "Claude Proxy is running!"
	@echo "=========================================="
	@echo ""
	@echo "API Key: $$(grep API_KEY .env | cut -d= -f2)"
	@echo ""
	@echo "OpenAI-compatible endpoint: http://localhost:5766/v1"
	@echo ""
	@echo "Test with:"
	@echo '  curl http://localhost:5766/v1/chat/completions \'
	@echo '    -H "Authorization: Bearer $$(grep API_KEY .env | cut -d= -f2)" \'
	@echo '    -H "Content-Type: application/json" \'
	@echo "    -d '{\"model\":\"sonnet\",\"messages\":[{\"role\":\"user\",\"content\":\"Hi\"}]}'"
	@echo ""

# Create .env if it doesn't exist
.env:
	@echo "API_KEY=sk-local-$$(openssl rand -hex 16)" > .env
	@echo "Created .env with API key"

# Build Docker image
build:
	docker compose build

# Start the proxy
start:
	docker compose up -d
	@echo "Proxy started at http://localhost:5766"

# Stop the proxy
stop:
	docker compose down
	@echo "Proxy stopped"

# View logs
logs:
	docker compose logs -f

# Clean up
clean:
	docker compose down -v
	rm -f .env
	@echo "Cleaned up"

# Test the proxy
test:
	@if [ ! -f .env ]; then echo "Run 'make setup' first"; exit 1; fi
	@echo "Testing health..."
	@curl -s http://localhost:5766/health | jq .
	@echo ""
	@echo "Testing chat completion..."
	@curl -s http://localhost:5766/v1/chat/completions \
		-H "Authorization: Bearer $$(grep API_KEY .env | cut -d= -f2)" \
		-H "Content-Type: application/json" \
		-d '{"model":"sonnet","messages":[{"role":"user","content":"Say hi in 5 words"}]}' | jq .

# Local development (foreground, with hot reload)
dev:
	npm install
	npm run dev

# Start proxy locally (background)
local-start: .env
	@if [ -f proxy.pid ] && kill -0 $$(cat proxy.pid) 2>/dev/null; then \
		echo "Proxy already running (PID $$(cat proxy.pid))"; \
	else \
		npm run build 2>/dev/null || npm install && npm run build; \
		API_KEY=$$(grep API_KEY .env | cut -d= -f2) PORT=5766 \
			nohup node dist/server.js > proxy.log 2>&1 & \
		echo $$! > proxy.pid; \
		sleep 1; \
		echo "Proxy started (PID $$(cat proxy.pid))"; \
		echo "Logs: tail -f proxy.log"; \
	fi

# Stop local proxy
local-stop:
	@if [ -f proxy.pid ]; then \
		kill $$(cat proxy.pid) 2>/dev/null && echo "Proxy stopped" || echo "Proxy not running"; \
		rm -f proxy.pid; \
	else \
		echo "No proxy.pid file found"; \
		pkill -f "node dist/server.js" 2>/dev/null && echo "Killed proxy process" || true; \
	fi

# Check local proxy status
local-status:
	@if [ -f proxy.pid ] && kill -0 $$(cat proxy.pid) 2>/dev/null; then \
		echo "Proxy running (PID $$(cat proxy.pid))"; \
		curl -s http://localhost:5766/health | jq . 2>/dev/null || echo "But not responding on port 5766"; \
	else \
		echo "Proxy not running"; \
	fi

# View local proxy logs
local-logs:
	@if [ -f proxy.log ]; then \
		tail -f proxy.log; \
	else \
		echo "No proxy.log found. Start proxy with: make local-start"; \
	fi

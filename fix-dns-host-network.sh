#!/bin/bash
# Quick DNS fix using host network mode

echo "=========================================="
echo "DNS Fix: Switching to Host Network Mode"
echo "=========================================="
echo ""

# Backup original docker-compose.yml
echo "1. Backing up docker-compose.yml..."
cp docker-compose.yml docker-compose.yml.backup
echo "✓ Backup created: docker-compose.yml.backup"
echo ""

# Create new docker-compose with host network
echo "2. Updating docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
version: '3.8'

services:
  agent:
    build: ./agent
    container_name: llm-watch-agent
    network_mode: "host"
    environment:
      - CEREBRAS_API_KEY=${CEREBRAS_API_KEY}
      - LLAMA_API_KEY=${LLAMA_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - PORT=8080
    restart: unless-stopped

  mcp-gateway:
    build:
      context: ./agent
      dockerfile: Dockerfile
    container_name: llm-watch-mcp-gateway
    command: node mcp_gateway.js
    network_mode: "host"
    environment:
      - CEREBRAS_API_KEY=${CEREBRAS_API_KEY}
      - LLAMA_API_KEY=${LLAMA_API_KEY}
      - OPENROUTER_API_KEY=${OPENROUTER_API_KEY}
      - MCP_GATEWAY_PORT=8081
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    container_name: llm-watch-grafana
    network_mode: "host"
    volumes:
      - ./plugin/anglerfishlyy-llmwatch-panel/dist:/var/lib/grafana/plugins/anglerfishlyy-llmwatch-panel
      - ./grafana/provisioning:/etc/grafana/provisioning
    environment:
      - GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=anglerfishlyy-llmwatch-panel
      - GF_DEFAULT_APP_MODE=development
    depends_on:
      - agent
    restart: unless-stopped

  prometheus:
    image: prom/prometheus:latest
    container_name: llm-watch-prometheus
    network_mode: "host"
    volumes:
      - ./prometheus/prometheus.yml:/etc/prometheus/prometheus.yml:ro
    depends_on:
      - agent
    restart: unless-stopped
EOF

echo "✓ docker-compose.yml updated with host network mode"
echo ""

# Restart services
echo "3. Restarting Docker services..."
docker compose down
sleep 2
docker compose up -d --build

echo ""
echo "4. Waiting for services to start..."
sleep 15

echo ""
echo "=========================================="
echo "Testing Providers"
echo "=========================================="
echo ""

# Test agent health
echo "Testing agent health..."
HEALTH=$(curl -s http://localhost:8080/health)
if echo "$HEALTH" | grep -q '"ok":true'; then
    echo "✓ Agent is healthy"
else
    echo "✗ Agent not responding"
    exit 1
fi

echo ""
echo "Testing OpenRouter (llama provider)..."
LLAMA_TEST=$(curl -s -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"llama","prompt":"Say hello","model":"meta-llama/llama-3-8b-instruct:free"}')

if echo "$LLAMA_TEST" | grep -q '"ok":true'; then
    echo "✓ OpenRouter (llama) working!"
    echo "$LLAMA_TEST" | grep -o '"latency":[0-9]*'
elif echo "$LLAMA_TEST" | grep -q "ENOTFOUND"; then
    echo "✗ Still DNS issues - check host network connectivity"
    echo "Try: ping api.openrouter.ai"
else
    echo "⚠ Response:"
    echo "$LLAMA_TEST" | head -c 300
fi

echo ""
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Host network mode applied. Services now use your host's DNS."
echo ""
echo "If OpenRouter still fails:"
echo "1. Check host DNS: nslookup api.openrouter.ai"
echo "2. Check firewall: sudo ufw status"
echo "3. Try Cloudflare DNS: See FINAL_STATUS.md Solution 3"
echo ""
echo "To restore original config:"
echo "  cp docker-compose.yml.backup docker-compose.yml"
echo "  docker compose down && docker compose up -d"
echo ""
echo "Test all providers:"
echo "  ./test-providers.sh"
echo ""

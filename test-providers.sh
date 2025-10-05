#!/bin/bash
# Test script for LLM Watch providers

echo "=========================================="
echo "LLM Watch Provider Test Script"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test agent health
echo "1. Testing Agent Health..."
HEALTH=$(curl -s http://localhost:8080/health)
if echo "$HEALTH" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ Agent is healthy${NC}"
    echo "$HEALTH" | grep -o '"providers":\[[^]]*\]'
else
    echo -e "${RED}✗ Agent is not responding${NC}"
    echo "Make sure Docker services are running: docker compose ps"
    exit 1
fi
echo ""

# Test Cerebras provider
echo "2. Testing Cerebras Provider..."
CEREBRAS_RESPONSE=$(curl -s -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"cerebras","prompt":"Say hello","model":"llama3.1-8b"}')

if echo "$CEREBRAS_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ Cerebras provider working${NC}"
    echo "$CEREBRAS_RESPONSE" | grep -o '"latency":[0-9]*'
elif echo "$CEREBRAS_RESPONSE" | grep -q "API key not configured"; then
    echo -e "${YELLOW}⚠ Cerebras API key not configured${NC}"
    echo "Add CEREBRAS_API_KEY to .env file"
elif echo "$CEREBRAS_RESPONSE" | grep -q "ENOTFOUND\|getaddrinfo"; then
    echo -e "${RED}✗ DNS resolution failed${NC}"
    echo "Check docker-compose.yml DNS settings"
else
    echo -e "${RED}✗ Cerebras provider failed${NC}"
    echo "$CEREBRAS_RESPONSE" | head -c 200
fi
echo ""

# Test Llama/OpenRouter provider
echo "3. Testing Llama Provider (OpenRouter)..."
LLAMA_RESPONSE=$(curl -s -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"llama","prompt":"Say hello","model":"meta-llama/llama-3-8b-instruct:free"}')

if echo "$LLAMA_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ Llama provider working${NC}"
    echo "$LLAMA_RESPONSE" | grep -o '"latency":[0-9]*'
elif echo "$LLAMA_RESPONSE" | grep -q "API key not configured"; then
    echo -e "${YELLOW}⚠ Llama API key not configured${NC}"
    echo "Add LLAMA_API_KEY or OPENROUTER_API_KEY to .env file"
elif echo "$LLAMA_RESPONSE" | grep -q "ENOTFOUND\|getaddrinfo"; then
    echo -e "${RED}✗ DNS resolution failed${NC}"
    echo "Check docker-compose.yml DNS settings"
else
    echo -e "${RED}✗ Llama provider failed${NC}"
    echo "$LLAMA_RESPONSE" | head -c 200
fi
echo ""

# Test OpenRouter provider
echo "4. Testing OpenRouter Provider..."
OPENROUTER_RESPONSE=$(curl -s -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"openrouter","prompt":"Say hello","model":"google/gemma-2-9b-it:free"}')

if echo "$OPENROUTER_RESPONSE" | grep -q '"ok":true'; then
    echo -e "${GREEN}✓ OpenRouter provider working${NC}"
    echo "$OPENROUTER_RESPONSE" | grep -o '"latency":[0-9]*'
elif echo "$OPENROUTER_RESPONSE" | grep -q "API key not configured"; then
    echo -e "${YELLOW}⚠ OpenRouter API key not configured${NC}"
    echo "Add OPENROUTER_API_KEY to .env file"
elif echo "$OPENROUTER_RESPONSE" | grep -q "ENOTFOUND\|getaddrinfo"; then
    echo -e "${RED}✗ DNS resolution failed${NC}"
    echo "Check docker-compose.yml DNS settings"
else
    echo -e "${RED}✗ OpenRouter provider failed${NC}"
    echo "$OPENROUTER_RESPONSE" | head -c 200
fi
echo ""

# Check metrics
echo "5. Checking Metrics..."
METRICS=$(curl -s http://localhost:8080/metrics/all)
METRIC_COUNT=$(echo "$METRICS" | grep -o '"count":[0-9]*' | grep -o '[0-9]*')

if [ -n "$METRIC_COUNT" ] && [ "$METRIC_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✓ Metrics available: $METRIC_COUNT entries${NC}"
else
    echo -e "${YELLOW}⚠ No metrics yet (demo metrics should appear in ~3 seconds)${NC}"
fi
echo ""

echo "=========================================="
echo "Test Summary"
echo "=========================================="
echo ""
echo "Next Steps:"
echo "1. Open Grafana: http://localhost:3000 (admin/admin)"
echo "2. Create new dashboard and add LLM Watch Panel"
echo "3. Select provider from dropdown"
echo "4. Click green 'Generate' button"
echo "5. View AI insights"
echo ""
echo "For detailed instructions, see:"
echo "- FIXES_SUMMARY.md"
echo "- DEPLOYMENT_GUIDE.md"
echo ""

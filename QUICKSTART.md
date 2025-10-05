# LLM Watch - Quick Start Guide

Get LLM Watch up and running in 5 minutes.

## Prerequisites

- Docker & Docker Compose installed
- At least one LLM provider API key (Cerebras, OpenRouter, or Llama)
- 4GB RAM available
- Ports 3000, 8080, 8081, 9090 available

## Step 1: Clone and Configure (2 minutes)

```bash
# Clone the repository (if not already done)
cd llm-watch-grafana

# Copy environment template
cp .env.example .env

# Edit .env and add your API key(s)
nano .env  # or use your preferred editor
```

**Minimum required:** Add at least one API key:
```bash
CEREBRAS_API_KEY=your_key_here
# OR
OPENROUTER_API_KEY=your_key_here
```

## Step 2: Build Plugin (1 minute)

```bash
cd plugin/anglerfishlyy-llmwatch-panel
npm install
npm run build
cd ../..
```

## Step 3: Start Services (1 minute)

```bash
docker compose up --build -d
```

Wait for services to start (~30 seconds).

## Step 4: Verify (1 minute)

```bash
# Check agent health
curl http://localhost:8080/health

# Make a test request
curl -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"cerebras","prompt":"Say hello","model":"llama3.1-8b"}'
```

## Step 5: Open Grafana

1. Open browser: http://localhost:3000
2. Login: `admin` / `admin` (skip password change for now)
3. Go to: Dashboards → New → New Dashboard
4. Click "Add visualization"
5. Select "LLM Watch Panel"
6. You should see metrics!

## Quick Test

Make a few requests to generate data:

```bash
# Request 1
curl -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"cerebras","prompt":"Explain AI in one sentence","model":"llama3.1-8b"}'

# Request 2
curl -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"cerebras","prompt":"What is machine learning?","model":"llama3.1-8b"}'

# Request 3
curl -X POST http://localhost:8080/call \
  -H "Content-Type: application/json" \
  -d '{"provider":"cerebras","prompt":"Define neural networks","model":"llama3.1-8b"}'
```

Refresh your Grafana panel to see the metrics!

## What You Get

- **Agent**: http://localhost:8080
  - REST API for LLM requests
  - Automatic metrics collection
  - Prometheus metrics exposition

- **MCP Gateway**: http://localhost:8081
  - Request forwarding service
  - Multi-provider support

- **Grafana**: http://localhost:3000
  - Beautiful metrics visualization
  - Real-time updates
  - Provider comparison

- **Prometheus**: http://localhost:9090
  - Metrics storage
  - Time-series data
  - Query interface

## Common Issues

### "Connection refused" errors
```bash
# Check if services are running
docker compose ps

# Check logs
docker compose logs agent
```

### "API key not configured" errors
```bash
# Verify .env file
cat .env | grep API_KEY

# Restart services after adding keys
docker compose restart
```

### Plugin not loading in Grafana
```bash
# Check plugin build
ls -la plugin/anglerfishlyy-llmwatch-panel/dist/

# Rebuild if needed
cd plugin/anglerfishlyy-llmwatch-panel
npm run build
cd ../..

# Restart Grafana
docker compose restart grafana
```

### No metrics appearing
```bash
# Check if requests are being made
curl http://localhost:8080/metrics/all

# Check Prometheus scraping
curl http://localhost:9090/api/v1/targets
```

## Next Steps

1. **Configure Panel Options**
   - Set latency thresholds
   - Set cost thresholds
   - Enable/disable sparklines

2. **Try Different Providers**
   ```bash
   # OpenRouter
   curl -X POST http://localhost:8080/call \
     -H "Content-Type: application/json" \
     -d '{"provider":"openrouter","prompt":"Hello","model":"meta-llama/llama-3-8b-instruct:free"}'
   
   # Via MCP Gateway
   curl -X POST http://localhost:8081/forward \
     -H "Content-Type: application/json" \
     -d '{"provider":"cerebras","prompt":"Hello"}'
   ```

3. **Explore Prometheus**
   - Open http://localhost:9090
   - Try queries:
     - `llm_requests_total`
     - `llm_request_duration_ms`
     - `rate(llm_requests_total[5m])`

4. **Create Custom Dashboards**
   - Add multiple panels
   - Compare providers
   - Track costs over time

5. **Read Documentation**
   - `README.md` - Overview
   - `agent/README.md` - Agent API details
   - `REFACTORING_SUMMARY.md` - Architecture details

## Stopping Services

```bash
# Stop all services
docker compose down

# Stop and remove volumes
docker compose down -v
```

## Development Mode

For development with hot reload:

```bash
# Terminal 1: Agent
cd agent
npm install
npm run dev

# Terminal 2: MCP Gateway
cd agent
npm run start:mcp

# Terminal 3: Plugin
cd plugin/anglerfishlyy-llmwatch-panel
npm run dev

# Terminal 4: Grafana (Docker)
docker run -d -p 3000:3000 \
  -v "$(pwd)/plugin/anglerfishlyy-llmwatch-panel/dist:/var/lib/grafana/plugins/anglerfishlyy-llmwatch-panel" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=anglerfishlyy-llmwatch-panel" \
  grafana/grafana:latest
```

## Getting Help

1. Check logs:
   ```bash
   docker compose logs -f agent
   docker compose logs -f grafana
   ```

2. Check health endpoints:
   ```bash
   curl http://localhost:8080/health
   curl http://localhost:8081/health
   ```

3. Review documentation:
   - `VERIFICATION_CHECKLIST.md` - Testing guide
   - `REFACTORING_SUMMARY.md` - Architecture details

4. Common solutions:
   - Restart services: `docker compose restart`
   - Rebuild: `docker compose up --build`
   - Clean start: `docker compose down -v && docker compose up --build`

## Success!

If you can:
- ✅ Make LLM requests via the agent
- ✅ See metrics in Grafana
- ✅ Query Prometheus metrics
- ✅ View provider comparisons

**You're all set!** 🎉

Now you can:
- Monitor LLM performance in real-time
- Track costs across providers
- Identify latency issues
- Compare model performance
- Build custom dashboards

---

**Need more details?** See the full README.md and documentation.

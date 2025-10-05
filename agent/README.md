# LLM Watch Agent

The agent is a modular Node.js service that proxies LLM requests to multiple providers and collects comprehensive metrics for observability.

## Architecture

```
agent/
├── config/
│   └── index.js          # Centralized configuration management
├── providers/
│   ├── index.js          # Provider registry and unified interface
│   ├── cerebras.js       # Cerebras API adapter
│   ├── openrouter.js     # OpenRouter API adapter
│   ├── llama.js          # Llama API adapter
│   └── mcpGateway.js     # MCP Gateway adapter
├── utils/
│   ├── errors.js         # Standardized error handling
│   └── metrics.js        # Metrics storage and management
├── server.js             # Main server entry point
├── mcp_gateway.js        # MCP Gateway service
└── tokenUtils.js         # Token estimation utility

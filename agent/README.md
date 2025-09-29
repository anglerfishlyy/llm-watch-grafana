# Agent (llm-watch-grafana/agent)

Quick agent to call Llama-like APIs and record simple metrics.

## Setup
1. copy .env.example to .env and fill values (LLAMA_ENDPOINT, LLAMA_API_KEY).
2. npm install
3. npm run dev

## Endpoints
POST /call   => { prompt: "text" }  (triggers model call)
GET  /metrics/latest => returns last series entries

NOTE: .env must not be committed.

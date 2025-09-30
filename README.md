# llm-watch-grafana - Real-time LLM Observability Platform for Grafana

Here's a comprehensive, professional README without emojis or symbols:
markdown# LLM Watch - Real-time LLM Observability Platform for Grafana

**Track:** Cerebras - Best use of Cerebras API  
**Hackathon:** FutureStack GenAI Hackathon 2024

## Table of Contents

- [Overview](#overview)
- [Problem Statement](#problem-statement)
- [Solution](#solution)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Getting Started](#getting-started)
- [Usage](#usage)
- [Features](#features)
- [Project Structure](#project-structure)
- [Development](#development)
- [Demo](#demo)
- [Future Enhancements](#future-enhancements)
- [Acknowledgments](#acknowledgments)
- [License](#license)

## Overview

LLM Watch is a comprehensive observability platform that provides real-time monitoring and visualization of Large Language Model operations. Built as a Grafana panel plugin, it leverages the Cerebras API for lightning-fast inference while tracking critical metrics like latency, token usage, costs, and error rates. The platform enables organizations to gain complete visibility into their LLM infrastructure, optimize costs, and maintain service quality.

## Problem Statement

Organizations deploying Large Language Models in production face several critical challenges:

**Lack of Visibility**: Teams have no real-time insight into how their LLM infrastructure is performing. When latency increases or costs spike, they discover it too late, often after user complaints or at the end of the billing cycle.

**Cost Management**: LLM API costs can escalate rapidly with token-based pricing. Without granular tracking of prompt tokens, completion tokens, and per-request costs, organizations struggle to budget and optimize their spending.

**Performance Monitoring**: Production LLM systems need consistent performance. Teams need to monitor response latency, detect quality drift, and identify error patterns before they impact end users.

**Integration Complexity**: Existing monitoring tools are not designed for LLM-specific metrics. Teams need purpose-built solutions that understand token economics, model-specific characteristics, and inference patterns.

## Solution

LLM Watch addresses these challenges through a purpose-built Grafana plugin that provides:

**Real-time Metrics Collection**: Every LLM request flowing through the system is instrumented, capturing latency, token counts, costs, and errors. The agent backend processes requests through the Cerebras API while simultaneously collecting detailed telemetry.

**Visual Dashboard**: A custom Grafana panel plugin displays metrics in an intuitive, actionable format. Users see current values with sparklines showing trends, aggregate statistics over rolling windows, and detailed charts for historical analysis.

**Cost Tracking**: Automatic calculation of request costs based on token usage and provider pricing. Teams can track spending in real-time and identify cost optimization opportunities.

**Alert System**: Configurable thresholds for latency and cost trigger visual alerts, enabling proactive response to performance degradation or budget overruns.

**Docker Deployment**: Complete containerization ensures consistent deployment across development and production environments. The entire stack starts with a single docker-compose command.

## Architecture

### High-Level Architecture
┌─────────────────────────────────────────────────────────────────────┐
│                         LLM Watch Platform                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────┐                                                  │
│  │   Client     │                                                  │
│  │ Application  │                                                  │
│  └──────┬───────┘                                                  │
│         │                                                           │
│         │ HTTP POST /api/llm/call                                  │
│         │ { prompt: "...", model: "..." }                          │
│         │                                                           │
│         ▼                                                           │
│  ┌──────────────────────────────────────────┐                     │
│  │         Agent Backend (Node.js)          │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   Request Handler                  │  │                     │
│  │  │   - Validates input                │  │                     │
│  │  │   - Starts timer                   │  │                     │
│  │  └────────────┬───────────────────────┘  │                     │
│  │               │                            │                     │
│  │               ▼                            │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   Cerebras API Client              │  │                     │
│  │  │   - Formats request                │  │                     │
│  │  │   - Adds authentication            │  │                     │
│  │  │   - Sends to Cerebras              │  │                     │
│  │  └────────────┬───────────────────────┘  │                     │
│  │               │                            │                     │
│  └───────────────┼────────────────────────────┘                     │
│                  │                                                   │
│                  │ HTTPS                                             │
│                  │                                                   │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────┐                     │
│  │      Cerebras Inference API              │                     │
│  │   (World's Fastest AI Chip)              │                     │
│  │   - Processes prompt                     │                     │
│  │   - Returns completion                   │                     │
│  │   - Provides usage metrics               │                     │
│  └──────────────┬───────────────────────────┘                     │
│                  │                                                   │
│                  │ Response + Usage Data                             │
│                  │ { choices: [...], usage: {...} }                  │
│                  │                                                   │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────┐                     │
│  │         Agent Backend (Cont'd)           │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   Metrics Processor                │  │                     │
│  │  │   - Calculates latency             │  │                     │
│  │  │   - Extracts token counts          │  │                     │
│  │  │   - Computes cost                  │  │                     │
│  │  │   - Detects errors                 │  │                     │
│  │  └────────────┬───────────────────────┘  │                     │
│  │               │                            │                     │
│  │               ▼                            │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   In-Memory Metrics Store          │  │                     │
│  │  │   - Stores last 100 metrics        │  │                     │
│  │  │   - Provides query endpoints       │  │                     │
│  │  │   - Calculates aggregates          │  │                     │
│  │  └────────────┬───────────────────────┘  │                     │
│  └───────────────┼────────────────────────────┘                     │
│                  │                                                   │
│                  │ HTTP GET /api/metrics/all                         │
│                  │ HTTP GET /api/metrics/aggregates                  │
│                  │                                                   │
│                  ▼                                                   │
│  ┌──────────────────────────────────────────┐                     │
│  │     Grafana with LLM Watch Plugin        │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   Panel Plugin (React)             │  │                     │
│  │  │   - Fetches metrics via HTTP       │  │                     │
│  │  │   - Parses data frames             │  │                     │
│  │  │   - Renders visualizations         │  │                     │
│  │  └────────────┬───────────────────────┘  │                     │
│  │               │                            │                     │
│  │               ▼                            │                     │
│  │  ┌────────────────────────────────────┐  │                     │
│  │  │   Visualization Layer              │  │                     │
│  │  │   - Metric cards with sparklines   │  │                     │
│  │  │   - Aggregate statistics           │  │                     │
│  │  │   - Time-series charts             │  │                     │
│  │  │   - Alert indicators               │  │                     │
│  │  └────────────────────────────────────┘  │                     │
│  └──────────────────────────────────────────┘                     │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘

### Data Flow Architecture
Request Lifecycle:

Client Request
└─> POST /api/llm/call
└─> { prompt: "Explain quantum computing", model: "llama3.1-8b" }
Agent Processing
└─> Start timestamp = Date.now()
└─> Format Cerebras API request
└─> Add authentication header
└─> Send to api.cerebras.ai/v1/chat/completions
Cerebras Inference
└─> Process on world's fastest AI chip
└─> Generate completion
└─> Return response with usage data
└─> {
choices: [{ message: { content: "..." } }],
usage: {
prompt_tokens: 12,
completion_tokens: 156,
total_tokens: 168
}
}
Metrics Collection
└─> End timestamp = Date.now()
└─> Calculate latency = end - start
└─> Extract prompt_tokens, completion_tokens
└─> Calculate cost = (total_tokens / 1M) * price_per_1M
└─> Create metric object:
{
timestamp: 1696234567890,
latency: 127,
promptTokens: 12,
completionTokens: 156,
totalTokens: 168,
cost: 0.0000168,
error: null,
model: "llama3.1-8b"
}
└─> Store in metrics array
Metrics Storage
└─> Append to in-memory array
└─> Maintain rolling window (last 100 requests)
└─> Calculate aggregates on demand
Grafana Visualization
└─> Panel queries: GET /api/metrics/all
└─> Parse response into data frames
└─> Render real-time dashboard
└─> Update every 3 seconds (Grafana refresh)


### Component Interaction Diagram
┌─────────────────────────────────────────────────────────────────┐
│                      Docker Network: llm-watch                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────┐                                       │
│  │   Agent Container    │                                       │
│  │   (node:18-alpine)   │                                       │
│  │  Port: 8080          │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │ Express Server │  │                                       │
│  │  │ - CORS enabled │  │                                       │
│  │  │ - JSON parsing │  │                                       │
│  │  └────────────────┘  │                                       │
│  │  Environment:         │                                       │
│  │  - CEREBRAS_API_KEY  │                                       │
│  │  - PORT=8080         │                                       │
│  └──────────┬───────────┘                                       │
│             │                                                     │
│             │ Internal network communication                      │
│             │ http://agent:8080                                  │
│             │                                                     │
│             ▼                                                     │
│  ┌──────────────────────┐                                       │
│  │ Grafana Container    │                                       │
│  │ (grafana/grafana)    │                                       │
│  │  Port: 3000          │                                       │
│  │  ┌────────────────┐  │                                       │
│  │  │ Plugin System  │  │                                       │
│  │  │ - Loads plugin │  │                                       │
│  │  │ - Renders UI   │  │                                       │
│  │  └────────────────┘  │                                       │
│  │  Volumes:             │                                       │
│  │  - ./dist mounted    │                                       │
│  │  - provisioning      │                                       │
│  └──────────────────────┘                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
External Network:
│
│ Port 3000 → Grafana Web UI
│ Port 8080 → Agent API (optional external access)
│
▼
User Browser

### Plugin Architecture
Grafana Panel Plugin Structure:
plugin/anglerfishlyy-llmwatch-panel
 ├─src/
    ├── components/
    │   └── LLMWatchPanel.tsx
    │       │
    │       ├─> Panel Entry Point
    │       │   └─> Receives PanelProps from Grafana
    │       │       └─> { options, data, width, height }
    │       │
    │       ├─> Data Processing Layer
    │       │   └─> Parses DataFrame from data source
    │       │   └─> Extracts fields: timestamp, latency, tokens, cost, error
    │       │   └─> Calculates aggregates: avg latency, avg cost, error rate
    │       │
    │       ├─> Visualization Components
    │       │   ├─> MetricCard
    │       │   │   └─> Displays single metric with sparkline
    │       │   │   └─> Shows trend indicator
    │       │   │   └─> Renders alert badge if threshold exceeded
    │       │   │
    │       │   ├─> Aggregate Stats Cards
    │       │   │   └─> Rolling window calculations (last 10 requests)
    │       │   │   └─> Average latency, cost, error rate
    │       │   │
    │       │   └─> Charts
    │       │       ├─> Latency Trend (Area Chart)
    │       │       ├─> Cost Trend (Area Chart)
    │       │       └─> Token Distribution (Bar Chart)
    │       │
    │       └─> Theme Integration
    │           └─> Uses Grafana theme system
    │           └─> Responsive to light/dark mode
    │           └─> Follows typography guidelines
    │
    ├── module.ts
    │   └─> Plugin registration
    │   └─> Exports PanelPlugin instance
    │   └─> Defines panel options schema
    │
    └── plugin.json
        └─> Plugin metadata
        └─> Type: panel
        └─> Dependencies and version info

## Technology Stack

### Core Technologies

**Cerebras API**: The backbone of our inference layer. Cerebras provides the world's fastest AI chip, enabling sub-100ms latency for LLM requests. The API returns detailed usage metrics including prompt tokens, completion tokens, and total tokens, which we use for cost calculation and performance analysis.

**Grafana**: Industry-standard observability platform. We chose Grafana because it is the de facto tool for monitoring production systems, has an extensive plugin ecosystem, and provides a robust framework for building custom visualizations.

**Docker**: Containerization ensures consistent deployment across environments. Docker Compose orchestrates the multi-container architecture, handling networking, volumes, and environment variables seamlessly.

### Backend Stack

**Node.js 18**: Modern JavaScript runtime with excellent async performance for handling concurrent API requests and metrics processing.

**Express.js**: Lightweight web framework for building the RESTful API that serves as the bridge between client applications and the Cerebras API.

**CORS Middleware**: Enables cross-origin requests from Grafana, which runs on a different port in development and potentially different domain in production.

### Frontend Stack

**React 18**: Powers the Grafana panel plugin UI. We use functional components with hooks for state management and side effects.

**Recharts**: Declarative charting library for React. Chosen for its flexibility, responsive design, and compatibility with Grafana's theme system.

**Grafana UI Library**: Official component library providing theme-aware UI components like Cards, Badges, and Typography that match Grafana's design language.

**Lucide React**: Modern icon library providing crisp, customizable icons for metrics visualization.

### Development Tools

**TypeScript**: Static typing ensures code quality and provides excellent developer experience with IntelliJ sense and compile-time error checking.

**Grafana Plugin Tools**: Official scaffolding and build tools from Grafana Labs. We used create-plugin to initialize the project structure following Grafana's best practices.

**Webpack**: Module bundler configured by Grafana plugin tools to build the production bundle compatible with Grafana's plugin system.

## Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- Node.js version 18 or higher
- npm version 8 or higher
- Docker Desktop version 20 or higher
- Git for version control
- A Cerebras API key (sign up at cerebras.ai)

### Installation

**Step 1: Clone the repository**
```bash
git clone https://github.com/anglerfishlyy/llm-watch-grafana.git
cd llm-watch-grafana
```
Step 2: Install plugin dependencies
```cd plugin && npm install```
Step 3: Install agent dependencies
```bash 
cd agent 
npm install
cd ..
```

Step 4: Configure environment variables
Create a .env file in the agent directory:

```bash 
cd agent
cp .env.example .env
```

Edit the .env file and add your Cerebras API key:
```bash 
CEREBRAS_API_KEY=your_cerebras_api_key_here
PORT=8080
```
Step 5: Build the plugin
```bash
npm run build
```
This compiles the TypeScript code and bundles the plugin using Webpack. The output is placed in the dist/ directory, which Docker will mount into the Grafana container.
Running with Docker
Start the entire stack:
```bash
docker-compose up 
```
This command:

Builds the agent container from the Node.js Alpine image
Pulls the latest Grafana image
Creates a Docker network for inter-container communication
Starts both containers with appropriate port mappings
Mounts the plugin dist folder into Grafana

Access the application:

Grafana UI: http://localhost:3000
Agent API: http://localhost:8080
Default Grafana credentials: admin / admin

First-time setup in Grafana:

Log in with admin/admin
Navigate to Dashboards → New Dashboard
Add a new panel
Select "LLM Watch Panel" from the visualization dropdown
Configure panel options if needed
Save the dashboard

Running for Development
If you prefer to run services individually for development:
Terminal 1: Start the agent
```bash 
cd agent
npm run dev
```
Terminal 2: Start the plugin in watch mode
```bash
npm run dev
```
Terminal 3: Start Grafana
```bash 
docker run -d -p 3000:3000 \
  -v "$(pwd)/dist:/var/lib/grafana/plugins/llm-watch-panel" \
  -e "GF_PLUGINS_ALLOW_LOADING_UNSIGNED_PLUGINS=llm-watch-panel" \
  grafana/grafana:latest
  ```
This setup enables hot reloading for both the agent and plugin, streamlining the development workflow.
Usage
Making LLM Requests
The agent exposes a REST API for making LLM requests through Cerebras:
Endpoint: POST http://localhost:8080/api/llm/call
Request body:
json{
  "prompt": "Explain quantum computing in simple terms",
  "model": "llama3.1-8b"
}
Response:
json{
  "timestamp": 1696234567890,
  "latency": 127,
  "promptTokens": 12,
  "completionTokens": 156,
  "totalTokens": 168,
  "cost": 0.0000168,
  "error": null,
  "model": "llama3.1-8b",
  "response": "Quantum computing is a type of computing that uses..."
}
Example using curl:
bashcurl -X POST http://localhost:8080/api/llm/call \
  -H "Content-Type: application/json" \
  -d '{"prompt": "What is machine learning?", "model": "llama3.1-8b"}'
Example using JavaScript:
javascriptconst response = await fetch('http://localhost:8080/api/llm/call', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    prompt: 'Explain neural networks',
    model: 'llama3.1-8b'
  })
});

const metrics = await response.json();
console.log(`Latency: ${metrics.latency}ms, Cost: $${metrics.cost}`);
Viewing Metrics in Grafana
Once you have made some requests, metrics automatically appear in the Grafana dashboard:
Metric Cards: Display current values for latency, cost, and token usage. Each card includes a sparkline showing the recent trend and a percentage change indicator comparing the current value to the previous request.
Aggregate Statistics: Show rolling averages over the last 10 requests, providing insight into overall system performance rather than individual spikes.
Time-Series Charts: Visualize how metrics change over time. The latency and cost charts use area fills to make trends more apparent. The token distribution chart uses stacked bars to show the balance between prompt and completion tokens.
Alert Indicators: When latency or cost exceeds configured thresholds, alert badges appear on the relevant metric cards with red borders for immediate visibility.
Configuring Panel Options
The plugin provides several configuration options accessible through the Grafana panel editor:
Show Sparklines: Toggle the mini trend charts in metric cards. Disable this for very small panels or when screen space is limited.
Latency Thresholds: Set warning and critical thresholds in milliseconds. The metric card changes color based on these values:

Green: Below warning threshold
Orange: Between warning and critical
Red: Above critical threshold

Cost Thresholds: Similar to latency, set warning and critical thresholds for per-request cost in dollars.
Example threshold configuration:

Latency warning: 100ms (good performance)
Latency critical: 200ms (needs attention)
Cost warning: $0.0001 (typical for small requests)
Cost critical: $0.0002 (expensive requests)

Features
Real-Time Monitoring
Every request through the agent is instrumented automatically. There is no need for manual instrumentation or separate tracking code. The agent intercepts each Cerebras API call, measures elapsed time, extracts usage data from the response, and stores the complete metric snapshot.
Grafana refreshes the dashboard every three seconds by default, providing near real-time visibility. Users can adjust the refresh interval in Grafana's time range picker to balance between freshness and system load.
Cost Analysis
Token-based pricing makes LLM costs variable and sometimes unpredictable. LLM Watch calculates cost for every request using the formula:
cost = (prompt_tokens + completion_tokens) / 1_000_000 * price_per_million_tokens
The current implementation uses Cerebras pricing estimates. For production use, update the pricing constants in the agent code to match your actual provider rates.
Cost tracking enables several use cases:

Budget monitoring across development teams
Identifying expensive prompts that need optimization
Comparing cost efficiency between different models
Forecasting monthly spend based on current usage patterns

Performance Tracking
Latency is measured from the moment the agent sends the request to Cerebras until it receives the complete response. This end-to-end measurement includes network time, inference time, and any provider-side queuing.
The dashboard shows three latency views:

Current latency for the most recent request
Average latency over the last 10 requests
Historical trend chart showing latency over the selected time range

Performance degradation often follows patterns. A gradual increase might indicate provider load issues. Sudden spikes could signal network problems. Consistent high latency suggests the need for model optimization or provider selection.
Error Monitoring
When requests fail, whether due to network issues, API errors, or invalid inputs, the agent captures the error message and includes it in the metrics. The error rate aggregate shows what percentage of recent requests failed.
Error tracking helps identify:

API key or authentication problems
Rate limiting issues
Invalid request formats
Provider outages or degraded service

Responsive Design
The plugin adapts to available space using Grafana's width and height props. On narrow panels, components stack vertically. On wide panels, they arrange in columns. When height is constrained, the plugin hides less critical elements like sparklines and detailed charts, keeping only the essential current metrics visible.
This responsive behavior ensures the plugin works well whether used in a small dashboard tile, a dedicated full-screen monitoring view, or anything in between.
Docker Deployment
The complete stack runs in Docker with a single command. The docker-compose configuration handles:
Networking: Creates an isolated network where the agent and Grafana communicate using service names rather than IP addresses. This makes the setup portable across environments.
Volumes: Mounts the plugin build output into Grafana's plugin directory. Grafana automatically loads the plugin on startup.
Environment Variables: Passes the Cerebras API key to the agent container securely without committing secrets to version control.
Dependencies: Ensures Grafana starts only after the agent is ready, preventing connection errors during startup.
Port Mapping: Exposes Grafana on port 3000 and optionally exposes the agent on port 8080 for external access.
Project Structure
......will update soon....
Key Files Explained
src/components/LLMWatchPanel.tsx: The React component that renders the dashboard. It receives data from Grafana, processes it into the expected format, calculates aggregates, and renders metric cards and charts. This file contains all visualization logic and uses Grafana's theme system for consistent styling.
src/module.ts: Exports the PanelPlugin instance that Grafana loads. It registers the panel type, defines configuration options that appear in the panel editor, and specifies default values for those options.
src/plugin.json: Metadata file that Grafana reads to understand the plugin. It includes the plugin ID, type, name, and version. This file must be present and correctly formatted for Grafana to recognize the plugin.
agent/index.js: The backend server that processes LLM requests. It handles HTTP requests, calls the Cerebras API, measures latency, extracts usage data, calculates costs, stores metrics in memory, and provides query endpoints for Grafana.
agent/Dockerfile: Defines how to build the agent container. It uses a Node.js Alpine base image for a small footprint, copies package files, installs dependencies, copies application code, exposes port 8080, and sets the start command.
docker-compose.yml: Orchestrates both the agent and Grafana containers. It defines services, configures networking, sets up volumes, passes environment variables, and specifies startup order.
Development
Plugin Development
The plugin was scaffolded using Grafana's official tooling. Grafana Labs provides a command-line tool called create-plugin that generates a complete plugin structure following their best practices and conventions.
Initial scaffolding command:
bashnpx @grafana/create-plugin@latest
This tool prompted for:

Plugin type: Panel
Plugin name: LLM Watch Panel
Organization: kavyalegitimate
Backend: No backend 

The scaffolding created the entire plugin structure including TypeScript configuration, ESLint rules, Webpack config, and GitHub workflows for automated building and testing.
Development workflow:
Start the plugin in development mode with hot reloading:
bashnpm run dev
This runs Webpack in watch mode. Any changes to TypeScript or React files trigger automatic recompilation. Grafana detects the updated bundle and reloads the plugin without requiring a browser refresh.
Build for production:
bashnpm run build
This creates an optimized production bundle in the dist/ directory with minification and tree shaking applied.
Type checking:
bashnpm run typecheck
Runs the TypeScript compiler in check mode without emitting files, ensuring type safety.
Linting:
bashnpm run lint
Runs ESLint with Grafana's recommended rules to catch code quality issues.
Agent Development
The agent is a standalone Node.js application. For development, use nodemon for automatic restarts on file changes:
bashcd agent
npm run dev
Adding new endpoints:
Add route handlers in index.js:
javascriptapp.get('/api/metrics/summary', (req, res) => {
  // Calculate and return summary statistics
  const summary = {
    totalRequests: metrics.length,
    totalCost: metrics.reduce((sum, m) => sum + m.cost, 0),
    avgLatency: metrics.reduce((sum, m) => sum + m.latency, 0) / metrics.length
  };
  res.json(summary);
});
Modifying cost calculation:
Update the calculateCost function to reflect your provider's actual pricing:
javascriptfunction calculateCost(usage, model) {
  const rates = {
    'llama3.1-8b': 0.10,    // per 1M tokens
    'llama3.1-70b': 0.80,   // per 1M tokens
  };
  
  const rate = rates[model] || 0.10;
  const totalTokens = (usage.prompt_tokens || 0) + (usage.completion_tokens || 0);
  return (totalTokens / 1000000) * rate;
}
Testing
Manual testing workflow:

Start both agent and Grafana
Open Grafana at http://localhost:3000
Create a test dashboard with the LLM Watch panel
Use curl or Postman to send test requests:

bash# Test successful request
curl -X POST http://localhost:8080/api/llm/call \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Hello", "model": "llama3.1-8b"}'

# Verify metrics endpoint
curl http://localhost:8080/api/metrics/all

Observe metrics appearing in the Grafana dashboard
Test threshold alerts by sending requests that exceed configured limits

Unit testing (future enhancement):
Add Jest for testing utility functions:
bashnpm install --save-dev jest @types/jest
Example test file:
javascript// agent/calculateCost.test.js
const { calculateCost } = require('./utils');

test('calculates cost correctly', () => {
  const usage = { prompt_tokens: 10, completion_tokens: 90 };
  const cost = calculateCost(usage);
  expect(cost).toBeCloseTo(0.00001);
});
Contributing
Contributions are welcome. To contribute:

Fork the repository
Create a feature branch: git checkout -b feature/your-feature-name
Make your changes following the existing code style
Commit with descriptive messages: git commit -m "feat: add token usage histogram"
Push to your fork: `git push origin feature/your-feature-
RetryClaude does not have the ability to run the code it generates yet.MContinueEditname"`
6. Open a pull request with a clear description of the changes
Code style guidelines:

Use TypeScript for plugin code with strict type checking enabled
Follow Grafana's naming conventions for components and functions
Write descriptive commit messages following conventional commits format
Add comments for complex logic or non-obvious design decisions
Ensure code passes ESLint checks before committing

Commit message format:
feat: add new feature
fix: resolve bug
docs: update documentation
chore: maintenance tasks
refactor: code restructuring
test: add or update tests

Acknowledgments
This project was built for the FutureStack GenAI Hackathon 2025 organized by WeMakeDevs. 
Sponsor Technologies
Cerebras Systems
Cerebras built the world's largest and fastest AI chip specifically designed for AI workloads. Their inference API provides lightning-fast response times that make real-time LLM applications practical. The detailed usage metrics returned by their API enabled accurate cost calculation and performance tracking in this project.
We used Cerebras documentation, quickstart guides, and example implementations extensively during development. Their developer resources made integration straightforward and their Discord community provided valuable support.
Docker
Docker's containerization technology made this project portable and easy to deploy. Docker Compose simplified orchestration of the multi-container architecture. The consistent environment provided by containers eliminated "works on my machine" problems and streamlined both development and production deployment.
Docker's extensive documentation and community resources were instrumental in configuring the networking, volumes, and environment variable handling needed for this project.
Meta
While this project primarily uses Cerebras for inference, Meta's Llama family of open-source models provides the underlying LLM capabilities. The Llama 3.1 models offer excellent performance and quality, making them ideal for production applications.
Meta's open-source approach and comprehensive documentation around Llama usage, fine-tuning, and deployment informed the design decisions in this project.
Grafana Labs
The project uses Grafana's open-source observability platform and follows their plugin development guidelines. Grafana Labs provides excellent documentation, scaffolding tools, and a welcoming developer community that made building this plugin possible.
Key resources that enabled this project:

Plugin development documentation explaining the plugin system architecture
create-plugin CLI tool for generating a standards-compliant project structure
Grafana UI component library providing theme-aware, accessible components
Plugin examples repository demonstrating best practices and common patterns
Community forum where developers share knowledge and solve problems together

The decision to build this as a Grafana plugin rather than a standalone application was driven by Grafana's position as the industry standard for monitoring. Organizations already using Grafana can add LLM observability without adopting new tools or workflows.
Open Source Community
This project builds on the work of countless open-source contributors. Key dependencies include:

React and the React ecosystem for building user interfaces
Recharts for data visualization components
Express.js for building the REST API
Node.js for the JavaScript runtime environment
TypeScript for static type checking
Webpack for bundling application code

Each of these projects represents years of development effort by dedicated maintainers and contributors. This project would not be possible without their work.
Learning Resources
During development, I consulted numerous tutorials, blog posts, and documentation sources:

Grafana documentation on panel plugin development
Cerebras API documentation and quickstart guides
Docker documentation on compose and multi-container applications
TypeScript handbook for type system features
React documentation on hooks and component patterns
Various blog posts on LLM observability and cost optimization


LLM Watch addresses a critical gap in the observability landscape. As organizations increasingly rely on Large Language Models for production applications, they need purpose-built tools for monitoring these systems. Generic monitoring solutions do not understand token economics, model-specific characteristics, or the unique performance considerations of LLM operations.
This project demonstrates that comprehensive LLM observability is achievable using modern technologies. The combination of Cerebras for fast inference, Grafana for visualization, and Docker for deployment creates a practical, production-ready solution.
The hackathon provided an opportunity to validate this concept and build a working prototype. The positive response from early users and the value demonstrated in testing suggest real-world applicability beyond the hackathon context.
We hope this project contributes to the growing ecosystem of tools for building reliable, cost-effective LLM applications. As the technology matures, observability will become increasingly important. Projects like LLM Watch represent one approach to solving these challenges.
Thank you for your interest in this project. We look forward to continuing development and welcome contributions from the community.

Built with passion for the FutureStack GenAI Hackathon 2025
Powered by Cerebras | Containerized with Docker | Visualized with Grafana

------------
MIT License

Copyright (c) 2025 [kavya samudrala]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
Third-Party Licenses
This project incorporates open-source software with various licenses:

React (MIT License)
Recharts (MIT License)
Express.js (MIT License)
Grafana UI (Apache License 2.0)
Lucide React (ISC License)
The developer community's willingness to share knowledge freely accelerates innovation and enables projects like this one.
License
This project is licensed under the MIT License. You are free to use, modify, and distribute this software for any purpose, commercial or non-commercial, subject to the terms of the license.
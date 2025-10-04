import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { calculateTokens } from "./tokenUtils.js";
import { callProvider } from './providers/index.js';
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
// allow all origins for demo/dev convenience (can be restricted later)
app.use(cors());
const PORT = process.env.PORT || 8080;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY; // placeholder for Meta
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const LLAMA_API_URL = "https://api.llama.meta/v1/chat/completions";

// in-memory store
let metrics = [];

// Prometheus counters/gauges stored in-memory for exposition
let prometheusCounters = {
  requests_total: 0,
};

// Provider adapters are implemented in /providers and called via callProvider

// Generate random demo metrics
function generateDemoMetrics() {
  const latency = 50 + Math.random() * 200; // 50-250ms
  const promptTokens = Math.floor(Math.random() * 100);
  const completionTokens = Math.floor(Math.random() * 150);
  const totalTokens = promptTokens + completionTokens;
  const cost = totalTokens * 0.000001;

  const entry = {
    timestamp: Date.now(),
    provider: "demo",
    latency,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    error: null,
  };

  metrics.push(entry);
  // cap metrics for demo stability
  if (metrics.length > 500) metrics.shift();
}

// Auto-generate demo metrics every 3s
setInterval(generateDemoMetrics, 3000);

// Existing call endpoint
app.post('/call', async (req, res) => {
  const { provider = 'cerebras', prompt = '', model } = req.body || {};
  console.log(`Agent: /call invoked (provider=${provider}, model=${model || 'default'})`);

  const start = performance.now();
  try {
    const result = await callProvider({ provider, prompt, model });

    const latencyMs = result.latencyMs ?? performance.now() - start;
    const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    const entry = {
      timestamp: Date.now(),
      provider: result.provider || provider,
      model: result.model || model || 'unknown',
      latency: latencyMs,
      promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
      completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
      totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
      cost: result.cost ?? 0,
      error: result.error ?? null,
    };

    // push metrics and maintain cap
    metrics.push(entry);
    if (metrics.length > 500) metrics.shift();

    // update prometheus counters
    prometheusCounters.requests_total += 1;

    res.json({ ok: result.ok !== false, metrics: entry, output: result.response });
  } catch (err) {
    const latencyMs = performance.now() - start;
    const entry = {
      timestamp: Date.now(),
      provider,
      model: model || null,
      latency: latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      error: err && err.message ? String(err.message) : 'unknown_error',
    };

    metrics.push(entry);
    if (metrics.length > 500) metrics.shift();
    prometheusCounters.requests_total += 1;

    res.status(500).json({ ok: false, metrics: entry, error: entry.error });
  }
});

app.get("/metrics/latest", (req, res) => {
  console.log('Agent: /metrics/latest requested');
  res.json({ ok: true, metrics: metrics.slice(-1)[0] || null });
});

app.get("/metrics/all", (req, res) => {
  console.log('Agent: /metrics/all requested');
  res.json({ ok: true, metrics });
});

app.get("/metrics/aggregates", (req, res) => {
  const last10 = metrics.slice(-10);
  const avgLatency = last10.reduce((a, m) => a + (m.latency || 0), 0) / (last10.length || 1);
  const avgCost = last10.reduce((a, m) => a + (m.cost || 0), 0) / (last10.length || 1);
  const errorRate = last10.filter((m) => m.error !== null).length / (last10.length || 1);

  res.json({ ok: true, aggregates: { avgLatency, avgCost, errorRate } });
});

// Prometheus scrape endpoint (simple text exposition)
app.get('/metrics', (req, res) => {
  console.log('Agent: /metrics (Prometheus scrape) requested');
  // Expose counters and gauges labeled by provider and model for LLM observability
  // Build lines for Prometheus text exposition format
  const lines = [];
  lines.push('# HELP llm_requests_total Total number of LLM requests processed');
  lines.push('# TYPE llm_requests_total counter');

  // sum total
  lines.push(`llm_requests_total ${prometheusCounters.requests_total}`);

  lines.push('# HELP llm_request_duration_ms LLM request duration in milliseconds');
  lines.push('# TYPE llm_request_duration_ms gauge');

  // For per-provider/model breakdown expose latest/average metrics
  // Group by provider+model
  const groups = {};
  for (const m of metrics) {
    const key = `${m.provider || 'unknown'}::${m.model || 'default'}`;
    if (!groups[key]) groups[key] = { count: 0, sumLatency: 0, latestLatency: 0, errors: 0 };
    groups[key].count += 1;
    groups[key].sumLatency += Number(m.latency || 0);
    groups[key].latestLatency = Number(m.latency || 0);
    if (m.error) groups[key].errors += 1;
  }

  for (const k of Object.keys(groups)) {
    const [provider, model] = k.split('::');
    const g = groups[k];
    const avg = g.count ? g.sumLatency / g.count : 0;
    // Export an avg and latest metric for convenience
    lines.push(`llm_request_duration_ms{provider="${provider}",model="${model}",stat="avg"} ${avg}`);
    lines.push(`llm_request_duration_ms{provider="${provider}",model="${model}",stat="latest"} ${g.latestLatency}`);
    lines.push(`llm_requests_total{provider="${provider}",model="${model}",success="true"} ${g.count - g.errors}`);
    lines.push(`llm_requests_total{provider="${provider}",model="${model}",success="false"} ${g.errors}`);
  }

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Agent running on http://localhost:${PORT}`);
});

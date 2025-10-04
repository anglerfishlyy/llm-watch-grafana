import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { calculateTokens } from "./tokenUtils.js";
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

// Utility to call Cerebras
async function callCerebras(prompt) {
  try {
    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1-8b",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Cerebras API error ${response.status}: ${text}`);
    }
    return await response.json();
  } catch (err) {
    // rethrow to be handled by caller
    throw err;
  }
}

async function callLlama(prompt) {
  if (!LLAMA_API_KEY) {
    return {
      choices: [{ message: { content: "[LLAMA unavailable: no API key]" } }],
      usage: null,
    };
  }
  try {
    const response = await fetch(LLAMA_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LLAMA_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3-8b-chat",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Llama API error ${response.status}: ${text}`);
    }
    return await response.json();
  } catch (err) {
    throw err;
  }
}

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
app.post("/call", async (req, res) => {
  const { provider = "cerebras", prompt } = req.body;
  const start = performance.now();

  try {
    let json;
    if (provider === "llama") {
      json = await callLlama(prompt);
    } else {
      json = await callCerebras(prompt);
    }

    const latency = performance.now() - start;
    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens ?? calculateTokens(prompt);
    const completionTokens =
      usage.completion_tokens ?? calculateTokens(json.choices?.[0]?.message?.content || "");
    const totalTokens = promptTokens + completionTokens;

    const entry = {
      timestamp: Date.now(),
      provider,
      latency,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: totalTokens * 0.000001,
      error: null,
    };

    metrics.push(entry);
    if (metrics.length > 500) metrics.shift();

    res.json({ ok: true, metrics: entry, output: json.choices?.[0]?.message?.content });
  } catch (err) {
    const latency = performance.now() - start;
    const entry = {
      timestamp: Date.now(),
      provider,
      latency,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      error: err.message,
    };
    metrics.push(entry);
    if (metrics.length > 500) metrics.shift();
    res.status(500).json({ ok: false, metrics: entry, error: err.message });
  }
});

app.get("/metrics/latest", (req, res) => {
  res.json({ ok: true, metrics: metrics.slice(-1)[0] || null });
});

app.get("/metrics/all", (req, res) => {
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
  // basic metrics: http_requests_total and demo_latency_ms (gauge)
  const totalRequests = metrics.length;
  const latestLatency = metrics.slice(-1)[0]?.latency ?? 0;

  const lines = [];
  lines.push('# HELP http_requests_total Total number of HTTP requests processed (demo)');
  lines.push('# TYPE http_requests_total counter');
  lines.push(`http_requests_total ${totalRequests}`);

  lines.push('# HELP demo_latency_ms Latest latency observed in ms');
  lines.push('# TYPE demo_latency_ms gauge');
  lines.push(`demo_latency_ms ${latestLatency}`);

  res.set('Content-Type', 'text/plain; version=0.0.4');
  res.send(lines.join('\n'));
});

app.listen(PORT, () => {
  console.log(`Agent running on http://localhost:${PORT}`);
});

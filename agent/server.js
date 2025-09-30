import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { calculateTokens } from "./tokenUtils.js";
import cors from "cors";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: "http://localhost:3000"
}));
const PORT = process.env.PORT || 8080;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY; // placeholder for Meta
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";
const LLAMA_API_URL = "https://api.llama.meta/v1/chat/completions";

// in-memory store
let metrics = [];

// Utility to call Cerebras
async function callCerebras(prompt) {
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
  return response.json();
}

async function callLlama(prompt) {
  if (!LLAMA_API_KEY) {
    return {
      choices: [{ message: { content: "[LLAMA unavailable: no API key]" } }],
      usage: null,
    };
  }
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
  return response.json();
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
  if (metrics.length > 100) metrics.shift();
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
    if (metrics.length > 100) metrics.shift();

    res.json({ output: json.choices?.[0]?.message?.content, metrics: entry });
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
    res.status(500).json({ error: err.message });
  }
});

app.get("/metrics/latest", (req, res) => {
  res.json(metrics.slice(-1)[0] || {});
});

app.get("/metrics/all", (req, res) => {
  res.json(metrics);
});

app.get("/metrics/aggregates", (req, res) => {
  const last10 = metrics.slice(-10);
  const avgLatency = last10.reduce((a, m) => a + m.latency, 0) / (last10.length || 1);
  const avgCost = last10.reduce((a, m) => a + m.cost, 0) / (last10.length || 1);
  const errorRate =
    last10.filter((m) => m.error !== null).length / (last10.length || 1);

  res.json({
    avgLatency,
    avgCost,
    errorRate,
  });
});

app.listen(PORT, () => {
  console.log(`Agent running on http://localhost:${PORT}`);
});

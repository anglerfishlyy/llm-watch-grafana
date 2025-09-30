import express from "express";
import fetch from "node-fetch";
import dotenv from "dotenv";
import { performance } from "perf_hooks";
import { calculateTokens } from "./tokenUtils.js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 8080;
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const CEREBRAS_API_URL = "https://api.cerebras.ai/v1/chat/completions";

// in-memory store
let metrics = [];

app.post("/call", async (req, res) => {
  const { prompt } = req.body;
  const start = performance.now();

  try {
    const response = await fetch(CEREBRAS_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${CEREBRAS_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3.1-8b", // change to the model you want
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const json = await response.json();
    const latency = performance.now() - start;

    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens ?? calculateTokens(prompt);
    const completionTokens =
      usage.completion_tokens ?? calculateTokens(json.choices?.[0]?.message?.content || "");
    const totalTokens = promptTokens + completionTokens;

    const entry = {
      timestamp: Date.now(),
      latency,
      promptTokens,
      completionTokens,
      totalTokens,
      cost: totalTokens * 0.000001, // placeholder rate
      error: null,
    };

    metrics.push(entry);
    if (metrics.length > 100) metrics.shift();

    res.json({ output: json.choices?.[0]?.message?.content, metrics: entry });
  } catch (err) {
    const latency = performance.now() - start;
    const entry = {
      timestamp: Date.now(),
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
  const avgLatency = last10.reduce((a, m) => a + m.latency, 0) / last10.length;
  const avgCost = last10.reduce((a, m) => a + m.cost, 0) / last10.length;
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

require('dotenv').config();
const express = require('express');
const { parseUsage, estimateTokensFromText } = require('./tokenUtils');
const app = express();
app.use(express.json());

// Allow Grafana dev server in the browser to fetch
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

const PORT = process.env.PORT || 8080;
const metrics = []; // simple in-memory store for hackathon

// helper: perform model call using configured endpoint & key
async function makeModelCall(prompt) {
  const endpoint = process.env.LLAMA_ENDPOINT || '';
  if (!endpoint) throw new Error('LLAMA_ENDPOINT not set in .env');

  const model = process.env.MODEL || 'llama-4-scout-17b-16e-instruct';
  const apiKey = process.env.LLAMA_API_KEY || '';

  const body = {
    model,
    messages: [{ role: 'user', content: prompt }],
  };

  const start = Date.now();
  let data;
  let latency;
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: apiKey ? `Bearer ${apiKey}` : undefined,
      },
      body: JSON.stringify(body),
    });
    data = await res.json();
    latency = Date.now() - start;
  } catch (err) {
    latency = Date.now() - start;
    data = { error: String(err) };
  }

  // extract completion text if available (providers vary)
  const completionText =
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.output?.text ??
    '';

  const usage = data?.usage ?? data?.usage_stats ?? null;
  const { tokens_in, tokens_out } = parseUsage(usage, prompt, completionText);
  const costPerToken = parseFloat(process.env.COST_PER_TOKEN || '0');
  const cost = costPerToken ? (tokens_in + tokens_out) * costPerToken : 0;

  const entry = {
    ts: Date.now(),
    latency_ms: latency,
    tokens_in,
    tokens_out,
    cost,
    error: data?.error ?? null,
    raw: data, // raw response for debugging (careful with size)
  };

  metrics.push(entry);
  return entry;
}

// POST /call  -> trigger model call with { prompt: "..." }
app.post('/call', async (req, res) => {
  const prompt = req.body.prompt || req.query.prompt || 'Hello';
  try {
    const entry = await makeModelCall(prompt);
    // return a compact view to the caller
    res.json({
      ts: entry.ts,
      latency_ms: entry.latency_ms,
      tokens_in: entry.tokens_in,
      tokens_out: entry.tokens_out,
      cost: entry.cost,
      error: entry.error,
    });
  } catch (err) {
    const entry = {
      ts: Date.now(),
      latency_ms: null,
      tokens_in: 0,
      tokens_out: 0,
      cost: 0,
      error: String(err),
    };
    metrics.push(entry);
    res.status(500).json({ error: String(err) });
  }
});

// GET /metrics/latest -> last N series
app.get('/metrics/latest', (req, res) => {
  const lastN = parseInt(req.query.n || '50', 10);
  res.json({ series: metrics.slice(-lastN) });
});

// health
app.get('/health', (req, res) => res.json({ ok: true, entries: metrics.length }));

app.listen(PORT, () => console.log(`Agent running on ${PORT}`));

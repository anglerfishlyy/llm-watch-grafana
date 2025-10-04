import express from 'express';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
import cors from 'cors';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = process.env.MCP_GATEWAY_PORT || 8081;

// This gateway accepts { provider, model, prompt } and forwards to the appropriate upstream.
// For demo purposes it calls Cerebras or Llama directly using the same endpoints as the agent adapters.
const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.ai/v1/chat/completions';
const LLAMA_API_URL = process.env.LLAMA_API_URL || 'https://api.openrouter.ai/v1/answers';
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;
const LLAMA_API_KEY = process.env.LLAMA_API_KEY;

app.post('/forward', async (req, res) => {
  const { provider = 'cerebras', model = undefined, prompt = '' } = req.body || {};
  try {
    if (provider === 'llama') {
      if (!LLAMA_API_KEY) return res.status(500).json({ ok: false, error: 'no_llama_key' });
      const resp = await fetch(LLAMA_API_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${LLAMA_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model || 'llama-3-8b-chat', input: prompt }) });
      const json = await resp.json();
      const content = json.output?.[0]?.content || json.choices?.[0]?.message?.content || json.result || JSON.stringify(json);
      return res.json({ ok: true, provider: 'llama', model: model || 'llama-3-8b-chat', response: content, usage: json.usage || null });
    }

    // default to cerebras
    if (!CEREBRAS_API_KEY) return res.status(500).json({ ok: false, error: 'no_cerebras_key' });
    const resp = await fetch(CEREBRAS_API_URL, { method: 'POST', headers: { 'Authorization': `Bearer ${CEREBRAS_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: model || 'llama3.1-8b', messages: [{ role: 'user', content: prompt }] }) });
    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || JSON.stringify(json);
    return res.json({ ok: true, provider: 'cerebras', model: model || 'llama3.1-8b', response: content, usage: json.usage || null });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err && err.message ? String(err.message) : 'gateway_error' });
  }
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`MCP Gateway listening on http://0.0.0.0:${PORT}`);
});

export default app;

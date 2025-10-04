import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';

const CEREBRAS_API_URL = process.env.CEREBRAS_API_URL || 'https://api.cerebras.ai/v1/chat/completions';
const CEREBRAS_API_KEY = process.env.CEREBRAS_API_KEY;

export async function callCerebras({ prompt, model = 'llama3.1-8b' } = {}) {
  if (!CEREBRAS_API_KEY) {
    throw new Error('Cerebras API key not configured');
  }

  const start = Date.now();
  const resp = await fetch(CEREBRAS_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CEREBRAS_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    const latencyMs = Date.now() - start;
    throw new Error(`Cerebras API error ${resp.status}: ${text} (latencyMs=${latencyMs})`);
  }

  const json = await resp.json();
  const latencyMs = Date.now() - start;

  // normalize shape
  const content = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? '';
  const usage = json.usage || {};

  return {
    ok: true,
    provider: 'cerebras',
    model,
    response: content,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? calculateTokens(prompt),
      completion_tokens: usage.completion_tokens ?? calculateTokens(content),
      total_tokens: usage.total_tokens ?? (calculateTokens(prompt) + calculateTokens(content)),
    },
    cost: (usage.total_tokens ?? (calculateTokens(prompt) + calculateTokens(content))) * 0.000001,
    latencyMs,
  };
}

export default { call: callCerebras };

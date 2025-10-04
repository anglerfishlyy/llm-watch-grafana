import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';

const OPENROUTER_URL = process.env.OPENROUTER_URL || 'https://openrouter.ai/api/v1/chat/completions';
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

export async function callOpenRouter({ prompt, model = 'gpt-4o-mini' } = {}) {
  const start = Date.now();
  if (!OPENROUTER_API_KEY) {
    return {
      ok: false,
      provider: 'openrouter',
      model,
      response: '[OpenRouter API key not set]',
      usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) },
      cost: 0,
      latencyMs: 0,
      error: 'no_api_key',
    };
  }

  try {
    const resp = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ model, messages: [{ role: 'user', content: prompt }] }),
    });

    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, provider: 'openrouter', model, response: '', usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) }, cost: 0, latencyMs, error: `openrouter_error: ${resp.status} ${text}` };
    }

    const json = await resp.json();
    const content = json.choices?.[0]?.message?.content || json.choices?.[0]?.text || JSON.stringify(json);
    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens ?? calculateTokens(prompt);
    const completionTokens = usage.completion_tokens ?? calculateTokens(content);
    const total = usage.total_tokens ?? (promptTokens + completionTokens);

    return {
      ok: true,
      provider: 'openrouter',
      model,
      response: content,
      usage: { prompt_tokens: promptTokens, completion_tokens: completionTokens, total_tokens: total },
      cost: total * 0.0000005,
      latencyMs,
    };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, provider: 'openrouter', model, response: '', usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) }, cost: 0, latencyMs, error: err && err.message ? String(err.message) : 'openrouter_error' };
  }
}

export default { call: callOpenRouter };

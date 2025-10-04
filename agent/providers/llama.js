import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';

// This adapter tries to call a Llama-compatible API. By default it will use
// an environment-provided LLAMA_API_URL or a placeholder. The adapter expects
// LLAMA_API_KEY env var when required.
const LLAMA_API_URL = process.env.LLAMA_API_URL || 'https://api.openrouter.ai/v1/answers';
const LLAMA_API_KEY = process.env.LLAMA_API_KEY;

export async function callLlama({ prompt, model = 'llama-3-8b-chat' } = {}) {
  // If no API key provided, return a friendly fallback for demos
  if (!LLAMA_API_KEY) {
    const fake = '[LLAMA adapter unavailable — no LLAMA_API_KEY]';
    return {
      ok: false,
      provider: 'llama',
      model,
      response: fake,
      usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) },
      cost: 0,
      latencyMs: 0,
      error: 'no_api_key',
    };
  }

  const start = Date.now();

  // OpenRouter / HuggingFace style: adapt as needed for your provider
  const body = {
    model,
    input: prompt,
    // OpenRouter uses different payloads — keep minimal for compatibility
  };

  const resp = await fetch(LLAMA_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLAMA_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const latencyMs = Date.now() - start;

  if (!resp.ok) {
    const text = await resp.text();
    return {
      ok: false,
      provider: 'llama',
      model,
      response: '',
      usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) },
      cost: 0,
      latencyMs,
      error: `llama_api_error: ${resp.status} ${text}`,
    };
  }

  const json = await resp.json();
  // Try a few common response shapes
  const content = json.output?.[0]?.content || json.choices?.[0]?.message?.content || json.choices?.[0]?.text || json.result || JSON.stringify(json);
  const usage = json.usage || {};

  return {
    ok: true,
    provider: 'llama',
    model,
    response: content,
    usage: {
      prompt_tokens: usage.prompt_tokens ?? calculateTokens(prompt),
      completion_tokens: usage.completion_tokens ?? calculateTokens(content),
      total_tokens: usage.total_tokens ?? (calculateTokens(prompt) + calculateTokens(content)),
    },
    cost: (usage.total_tokens ?? (calculateTokens(prompt) + calculateTokens(content))) * 0.0000005,
    latencyMs,
  };
}

export default { call: callLlama };

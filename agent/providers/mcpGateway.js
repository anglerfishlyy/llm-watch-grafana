import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';

// The MCP Gateway is expected to run as a local service in the Docker network.
const MCP_GATEWAY_URL = process.env.MCP_GATEWAY_URL || 'http://mcp-gateway:8081/forward';

export async function callMcp({ prompt, provider = 'cerebras', model } = {}) {
  const start = Date.now();
  try {
    const resp = await fetch(MCP_GATEWAY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, prompt }),
    });

    const latencyMs = Date.now() - start;
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, provider: 'mcp', model, response: '', usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) }, cost: 0, latencyMs, error: `mcp_gateway_error: ${resp.status} ${text}` };
    }

    const json = await resp.json();
    // Expect the gateway to return a normalized envelope similar to our adapters
    return { ...json, latencyMs: json.latencyMs ?? latencyMs };
  } catch (err) {
    const latencyMs = Date.now() - start;
    return { ok: false, provider: 'mcp', model, response: '', usage: { prompt_tokens: calculateTokens(prompt), completion_tokens: 0, total_tokens: calculateTokens(prompt) }, cost: 0, latencyMs, error: err && err.message ? String(err.message) : 'mcp_gateway_error' };
  }
}

export default { call: callMcp };

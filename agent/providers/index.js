import * as cerebras from './cerebras.js';
import * as llama from './llama.js';
import * as openrouter from './openrouter.js';
import * as mcp from './mcpGateway.js';

const registry = {
  cerebras: cerebras.callCerebras || cerebras.call || cerebras.default?.call,
  // map both 'llama' and 'openrouter' to the OpenRouter adapter when available
  llama: openrouter.callOpenRouter || openrouter.call || openrouter.default?.call || (llama.callLlama || llama.call || llama.default?.call),
  openrouter: openrouter.callOpenRouter || openrouter.call || openrouter.default?.call,
  mcp: mcp.callMcp || mcp.call || mcp.default?.call,
};

export async function callProvider({ provider = 'cerebras', prompt, model } = {}) {
  const fn = registry[provider];
  if (!fn) {
    throw new Error(`Unknown provider: ${provider}`);
  }
  // Provider-specific call may return a normalized envelope; ensure we always return consistent shape
  const result = await fn({ prompt, model, provider });
  // result should already be normalized by adapters; provide guard defaults
  return {
    ok: result.ok ?? true,
    provider: result.provider ?? provider,
    model: result.model ?? model ?? 'unknown',
    response: result.response ?? result.output ?? '',
    usage: result.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    cost: result.cost ?? 0,
    latencyMs: result.latencyMs ?? result.latency ?? 0,
    error: result.error ?? null,
  };
}

export default registry;

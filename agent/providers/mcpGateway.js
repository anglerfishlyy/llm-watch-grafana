/**
 * @fileoverview MCP Gateway provider adapter
 * @module providers/mcpGateway
 */

import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';
import { config } from '../config/index.js';
import { ProviderError } from '../utils/errors.js';

/**
 * Call MCP Gateway for LLM inference
 * The MCP Gateway is a local service that forwards requests to configured providers
 * @param {Object} params - Request parameters
 * @param {string} params.prompt - Input prompt text
 * @param {string} [params.provider='cerebras'] - Target provider for the gateway
 * @param {string} [params.model] - Model identifier
 * @returns {Promise<Object>} Normalized response object
 * @throws {ProviderError} If gateway request fails
 */
export async function callMcp({ prompt, provider = 'cerebras', model } = {}) {
  const gatewayUrl = `${config.providers.mcp.url}/forward`;
  const start = Date.now();
  
  try {
    const resp = await fetch(gatewayUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ provider, model, prompt }),
    });

    const latencyMs = Date.now() - start;
    
    if (!resp.ok) {
      const text = await resp.text();
      throw new ProviderError('mcp', `Gateway returned ${resp.status}: ${text}`, {
        statusCode: resp.status,
        latencyMs,
        targetProvider: provider,
      });
    }

    const json = await resp.json();
    
    // Gateway should return normalized response, but ensure consistency
    const usage = json.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
    
    return {
      ok: json.ok ?? true,
      provider: 'mcp',
      model: json.model || model || 'unknown',
      response: json.response || json.output || '',
      usage: {
        prompt_tokens: usage.prompt_tokens ?? calculateTokens(prompt),
        completion_tokens: usage.completion_tokens ?? calculateTokens(json.response || ''),
        total_tokens: usage.total_tokens ?? (usage.prompt_tokens + usage.completion_tokens),
      },
      cost: json.cost ?? 0,
      latencyMs: json.latencyMs ?? latencyMs,
      error: json.error ?? null,
      targetProvider: provider,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    
    if (error instanceof ProviderError) {
      throw error;
    }
    
    throw new ProviderError('mcp', error.message, { 
      latencyMs,
      targetProvider: provider,
    });
  }
}

export default { call: callMcp };

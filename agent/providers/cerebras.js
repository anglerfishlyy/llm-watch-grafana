/**
 * @fileoverview Cerebras API provider adapter
 * @module providers/cerebras
 */

import fetch from 'node-fetch';
import { calculateTokens } from '../tokenUtils.js';
import { config } from '../config/index.js';
import { APIKeyMissingError, ProviderError, createErrorResponse } from '../utils/errors.js';

/**
 * Call Cerebras API for LLM inference
 * @param {Object} params - Request parameters
 * @param {string} params.prompt - Input prompt text
 * @param {string} [params.model='llama3.1-8b'] - Model identifier
 * @returns {Promise<Object>} Normalized response object
 * @throws {APIKeyMissingError} If API key is not configured
 * @throws {ProviderError} If API request fails
 */
export async function callCerebras({ prompt, model = 'llama3.1-8b' } = {}) {
  const { apiKey, apiUrl, costPerMillionTokens } = config.providers.cerebras;
  
  if (!apiKey) {
    throw new APIKeyMissingError('cerebras');
  }

  const start = Date.now();
  
  try {
    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        model, 
        messages: [{ role: 'user', content: prompt }] 
      }),
    });

    const latencyMs = Date.now() - start;

    if (!resp.ok) {
      const text = await resp.text();
      throw new ProviderError('cerebras', `API returned ${resp.status}: ${text}`, {
        statusCode: resp.status,
        latencyMs,
      });
    }

    const json = await resp.json();

    // Normalize response shape
    const content = json.choices?.[0]?.message?.content ?? json.choices?.[0]?.text ?? '';
    const usage = json.usage || {};
    
    const promptTokens = usage.prompt_tokens ?? calculateTokens(prompt);
    const completionTokens = usage.completion_tokens ?? calculateTokens(content);
    const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);

    return {
      ok: true,
      provider: 'cerebras',
      model,
      response: content,
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      cost: (totalTokens / 1_000_000) * costPerMillionTokens,
      latencyMs,
      error: null,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    
    // If it's already our error type, add latency and rethrow
    if (error instanceof APIKeyMissingError || error instanceof ProviderError) {
      throw error;
    }
    
    // Provide user-friendly error messages for common network issues
    let errorMessage = error.message || 'Unknown error';
    
    if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
      errorMessage = `Cannot reach Cerebras API (DNS resolution failed). Check: 1) Internet connectivity 2) Docker DNS settings (add dns: [8.8.8.8] to docker-compose.yml) 3) Firewall rules. Original error: ${error.message}`;
    } else if (errorMessage.includes('ECONNREFUSED')) {
      errorMessage = `Connection refused by Cerebras API. The service may be down or unreachable. Original error: ${error.message}`;
    } else if (errorMessage.includes('ETIMEDOUT')) {
      errorMessage = `Request timed out. Check internet connectivity and firewall settings. Original error: ${error.message}`;
    }
    
    // Wrap unexpected errors
    throw new ProviderError('cerebras', errorMessage, { latencyMs });
  }
}

export default { call: callCerebras };

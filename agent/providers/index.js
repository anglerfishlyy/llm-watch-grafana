/**
 * @fileoverview Provider registry and unified call interface
 * @module providers
 */

import * as cerebras from './cerebras.js';
import * as llama from './llama.js';
import * as openrouter from './openrouter.js';
import * as mcp from './mcpGateway.js';
import { InvalidRequestError, handleError, createErrorResponse } from '../utils/errors.js';

/**
 * Provider function registry
 * Maps provider names to their implementation functions
 */
const registry = {
  cerebras: cerebras.callCerebras,
  llama: llama.callLlama,
  openrouter: openrouter.callOpenRouter,
  mcp: mcp.callMcp,
};

/**
 * Get list of available providers
 * @returns {string[]} Array of provider names
 */
export function getAvailableProviders() {
  return Object.keys(registry);
}

/**
 * Check if a provider is registered
 * @param {string} provider - Provider name
 * @returns {boolean} True if provider exists
 */
export function isProviderAvailable(provider) {
  return provider in registry;
}

/**
 * Unified provider call interface
 * Routes requests to the appropriate provider and normalizes responses
 * @param {Object} params - Request parameters
 * @param {string} [params.provider='cerebras'] - Provider name
 * @param {string} params.prompt - Input prompt text
 * @param {string} [params.model] - Model identifier
 * @returns {Promise<Object>} Normalized response object
 * @throws {InvalidRequestError} If provider is unknown
 */
export async function callProvider({ provider = 'cerebras', prompt, model } = {}) {
  // Validate provider
  if (!isProviderAvailable(provider)) {
    throw new InvalidRequestError(
      `Unknown provider: ${provider}. Available providers: ${getAvailableProviders().join(', ')}`,
      { provider, availableProviders: getAvailableProviders() }
    );
  }

  // Validate prompt
  if (!prompt || typeof prompt !== 'string') {
    throw new InvalidRequestError(
      'Prompt is required and must be a string',
      { provider, prompt: typeof prompt }
    );
  }

  const start = Date.now();
  
  try {
    const fn = registry[provider];
    const result = await fn({ prompt, model, provider });
    
    // Normalize response structure
    return {
      ok: result.ok ?? true,
      provider: result.provider ?? provider,
      model: result.model ?? model ?? 'unknown',
      response: result.response ?? result.output ?? '',
      usage: result.usage ?? { 
        prompt_tokens: 0, 
        completion_tokens: 0, 
        total_tokens: 0 
      },
      cost: result.cost ?? 0,
      latencyMs: result.latencyMs ?? result.latency ?? (Date.now() - start),
      error: result.error ?? null,
    };
  } catch (error) {
    const latencyMs = Date.now() - start;
    
    // If it's already a structured error, convert to response format
    const normalizedError = handleError(error, provider);
    
    return createErrorResponse(normalizedError, provider, model, latencyMs);
  }
}

export default {
  callProvider,
  getAvailableProviders,
  isProviderAvailable,
  registry,
};

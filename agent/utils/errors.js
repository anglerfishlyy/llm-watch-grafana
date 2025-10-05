/**
 * @fileoverview Standardized error handling for the LLM Watch agent
 * @module utils/errors
 */

/**
 * Base error class for LLM Watch errors
 */
export class LLMWatchError extends Error {
  /**
   * @param {string} message - Error message
   * @param {string} code - Error code
   * @param {number} statusCode - HTTP status code
   * @param {Object} [details] - Additional error details
   */
  constructor(message, code, statusCode = 500, details = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Convert error to JSON response format
   * @returns {Object} JSON representation of the error
   */
  toJSON() {
    return {
      ok: false,
      error: {
        message: this.message,
        code: this.code,
        details: this.details,
      },
    };
  }
}

/**
 * Provider-specific error
 */
export class ProviderError extends LLMWatchError {
  /**
   * @param {string} provider - Provider name
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(provider, message, details = {}) {
    super(
      `Provider '${provider}' error: ${message}`,
      'PROVIDER_ERROR',
      502,
      { provider, ...details }
    );
  }
}

/**
 * API key missing error
 */
export class APIKeyMissingError extends LLMWatchError {
  /**
   * @param {string} provider - Provider name
   */
  constructor(provider) {
    super(
      `API key not configured for provider '${provider}'`,
      'API_KEY_MISSING',
      500,
      { provider }
    );
  }
}

/**
 * Invalid request error
 */
export class InvalidRequestError extends LLMWatchError {
  /**
   * @param {string} message - Error message
   * @param {Object} [details] - Additional error details
   */
  constructor(message, details = {}) {
    super(message, 'INVALID_REQUEST', 400, details);
  }
}

/**
 * Timeout error
 */
export class TimeoutError extends LLMWatchError {
  /**
   * @param {string} provider - Provider name
   * @param {number} timeout - Timeout duration in ms
   */
  constructor(provider, timeout) {
    super(
      `Request to provider '${provider}' timed out after ${timeout}ms`,
      'TIMEOUT',
      504,
      { provider, timeout }
    );
  }
}

/**
 * Network error
 */
export class NetworkError extends LLMWatchError {
  /**
   * @param {string} provider - Provider name
   * @param {string} message - Error message
   */
  constructor(provider, message) {
    super(
      `Network error for provider '${provider}': ${message}`,
      'NETWORK_ERROR',
      503,
      { provider }
    );
  }
}

/**
 * Handle and normalize errors
 * @param {Error} error - Error to handle
 * @param {string} [provider] - Provider name if applicable
 * @returns {LLMWatchError} Normalized error
 */
export function handleError(error, provider = 'unknown') {
  if (error instanceof LLMWatchError) {
    return error;
  }

  if (error.code === 'ECONNREFUSED') {
    return new NetworkError(provider, 'Connection refused');
  }

  if (error.code === 'ETIMEDOUT' || error.name === 'TimeoutError') {
    return new TimeoutError(provider, 30000);
  }

  // Generic error wrapper
  return new ProviderError(provider, error.message || 'Unknown error', {
    originalError: error.name,
  });
}

/**
 * Create error response object
 * @param {Error} error - Error object
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number} latencyMs - Request latency
 * @returns {Object} Standardized error response
 */
export function createErrorResponse(error, provider, model, latencyMs) {
  const llmError = handleError(error, provider);
  
  return {
    ok: false,
    provider,
    model: model || 'unknown',
    response: '',
    usage: {
      prompt_tokens: 0,
      completion_tokens: 0,
      total_tokens: 0,
    },
    cost: 0,
    latencyMs,
    error: llmError.message,
    errorCode: llmError.code,
    errorDetails: llmError.details,
  };
}

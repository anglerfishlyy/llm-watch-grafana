/**
 * @fileoverview Central configuration management for the LLM Watch agent
 * @module config
 */

import dotenv from 'dotenv';

dotenv.config();

/**
 * Application configuration object
 * @typedef {Object} AppConfig
 * @property {ServerConfig} server - Server configuration
 * @property {ProvidersConfig} providers - Provider API configurations
 * @property {MetricsConfig} metrics - Metrics storage configuration
 * @property {PrometheusConfig} prometheus - Prometheus configuration
 */

/**
 * Server configuration
 * @typedef {Object} ServerConfig
 * @property {number} port - Server port
 * @property {string} host - Server host
 * @property {boolean} corsEnabled - Enable CORS
 */

/**
 * Provider API configurations
 * @typedef {Object} ProvidersConfig
 * @property {ProviderConfig} cerebras - Cerebras configuration
 * @property {ProviderConfig} openrouter - OpenRouter configuration
 * @property {ProviderConfig} llama - Llama configuration
 * @property {MCPConfig} mcp - MCP Gateway configuration
 */

/**
 * Individual provider configuration
 * @typedef {Object} ProviderConfig
 * @property {string} apiKey - API key for the provider
 * @property {string} apiUrl - API endpoint URL
 * @property {number} timeout - Request timeout in milliseconds
 * @property {number} costPerMillionTokens - Cost per million tokens
 */

/**
 * MCP Gateway configuration
 * @typedef {Object} MCPConfig
 * @property {string} url - Gateway URL
 * @property {number} port - Gateway port
 * @property {number} timeout - Request timeout in milliseconds
 */

/**
 * Metrics configuration
 * @typedef {Object} MetricsConfig
 * @property {number} maxStorageSize - Maximum number of metrics to store in memory
 * @property {number} demoGenerationInterval - Interval for generating demo metrics (ms)
 */

/**
 * Prometheus configuration
 * @typedef {Object} PrometheusConfig
 * @property {boolean} enabled - Enable Prometheus metrics exposition
 * @property {string} endpoint - Metrics endpoint path
 */

/**
 * Get configuration value with fallback
 * @param {string} key - Environment variable key
 * @param {string|number} defaultValue - Default value if not set
 * @returns {string|number} Configuration value
 */
const getEnv = (key, defaultValue) => {
  return process.env[key] || defaultValue;
};

/**
 * Application configuration
 * @type {AppConfig}
 */
export const config = {
  server: {
    port: parseInt(getEnv('PORT', '8080'), 10),
    host: getEnv('HOST', '0.0.0.0'),
    corsEnabled: getEnv('CORS_ENABLED', 'true') === 'true',
  },

  providers: {
    cerebras: {
      apiKey: getEnv('CEREBRAS_API_KEY', ''),
      apiUrl: getEnv('CEREBRAS_API_URL', 'https://api.cerebras.ai/v1/chat/completions'),
      timeout: parseInt(getEnv('CEREBRAS_TIMEOUT', '30000'), 10),
      costPerMillionTokens: parseFloat(getEnv('CEREBRAS_COST_PER_MILLION', '0.10')),
    },
    openrouter: {
      apiKey: getEnv('OPENROUTER_API_KEY', ''),
      apiUrl: getEnv('OPENROUTER_URL', 'https://openrouter.ai/api/v1/chat/completions'),
      timeout: parseInt(getEnv('OPENROUTER_TIMEOUT', '30000'), 10),
      costPerMillionTokens: parseFloat(getEnv('OPENROUTER_COST_PER_MILLION', '0.50')),
    },
    llama: {
      apiKey: getEnv('LLAMA_API_KEY', ''),
      apiUrl: getEnv('LLAMA_API_URL', 'https://api.openrouter.ai/v1/chat/completions'),
      timeout: parseInt(getEnv('LLAMA_TIMEOUT', '30000'), 10),
      costPerMillionTokens: parseFloat(getEnv('LLAMA_COST_PER_MILLION', '0.50')),
    },
    mcp: {
      url: getEnv('MCP_GATEWAY_URL', 'http://mcp-gateway:8081'),
      port: parseInt(getEnv('MCP_GATEWAY_PORT', '8081'), 10),
      timeout: parseInt(getEnv('MCP_TIMEOUT', '30000'), 10),
    },
  },

  metrics: {
    maxStorageSize: parseInt(getEnv('METRICS_MAX_SIZE', '500'), 10),
    demoGenerationInterval: parseInt(getEnv('DEMO_INTERVAL', '3000'), 10),
  },

  prometheus: {
    enabled: getEnv('PROMETHEUS_ENABLED', 'true') === 'true',
    endpoint: getEnv('PROMETHEUS_ENDPOINT', '/metrics'),
  },
};

/**
 * Validate required configuration
 * @throws {Error} If required configuration is missing
 */
export function validateConfig() {
  const warnings = [];
  
  if (!config.providers.cerebras.apiKey) {
    warnings.push('CEREBRAS_API_KEY not set - Cerebras provider will be unavailable');
  }
  
  if (!config.providers.openrouter.apiKey) {
    warnings.push('OPENROUTER_API_KEY not set - OpenRouter provider will be unavailable');
  }
  
  if (!config.providers.llama.apiKey) {
    warnings.push('LLAMA_API_KEY not set - Llama provider will be unavailable');
  }
  
  if (warnings.length > 0) {
    console.warn('Configuration warnings:');
    warnings.forEach(w => console.warn(`  - ${w}`));
  }
}

export default config;

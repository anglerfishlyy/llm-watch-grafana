/**
 * @fileoverview Metrics storage and management utilities
 * @module utils/metrics
 */

import { config } from '../config/index.js';

/**
 * Metric entry structure
 * @typedef {Object} MetricEntry
 * @property {number} timestamp - Unix timestamp in milliseconds
 * @property {string} provider - Provider name (cerebras, llama, openrouter, mcp)
 * @property {string} model - Model identifier
 * @property {number} latency - Request latency in milliseconds
 * @property {number} promptTokens - Number of prompt tokens
 * @property {number} completionTokens - Number of completion tokens
 * @property {number} totalTokens - Total tokens (prompt + completion)
 * @property {number} cost - Estimated cost in USD
 * @property {string|null} error - Error message if request failed
 */

/**
 * In-memory metrics store
 */
class MetricsStore {
  constructor() {
    this.metrics = [];
    this.maxSize = config.metrics.maxStorageSize;
    this.prometheusCounters = {
      requests_total: 0,
      errors_total: 0,
    };
  }

  /**
   * Add a metric entry to the store
   * @param {MetricEntry} metric - Metric entry to add
   */
  add(metric) {
    this.metrics.push(metric);
    
    // Maintain size cap
    if (this.metrics.length > this.maxSize) {
      this.metrics.shift();
    }

    // Update Prometheus counters
    this.prometheusCounters.requests_total += 1;
    if (metric.error) {
      this.prometheusCounters.errors_total += 1;
    }
  }

  /**
   * Get all metrics
   * @returns {MetricEntry[]} All stored metrics
   */
  getAll() {
    return this.metrics;
  }

  /**
   * Get the latest metric
   * @returns {MetricEntry|null} Latest metric or null if none exist
   */
  getLatest() {
    return this.metrics.length > 0 ? this.metrics[this.metrics.length - 1] : null;
  }

  /**
   * Get last N metrics
   * @param {number} count - Number of metrics to retrieve
   * @returns {MetricEntry[]} Last N metrics
   */
  getLast(count) {
    return this.metrics.slice(-count);
  }

  /**
   * Get metrics filtered by provider
   * @param {string} provider - Provider name
   * @returns {MetricEntry[]} Filtered metrics
   */
  getByProvider(provider) {
    return this.metrics.filter(m => m.provider === provider);
  }

  /**
   * Calculate aggregates over last N metrics
   * @param {number} count - Number of recent metrics to aggregate
   * @returns {Object} Aggregate statistics
   */
  getAggregates(count = 10) {
    const recent = this.getLast(count);
    
    if (recent.length === 0) {
      return {
        avgLatency: 0,
        avgCost: 0,
        errorRate: 0,
        totalRequests: 0,
      };
    }

    const avgLatency = recent.reduce((sum, m) => sum + (m.latency || 0), 0) / recent.length;
    const avgCost = recent.reduce((sum, m) => sum + (m.cost || 0), 0) / recent.length;
    const errorCount = recent.filter(m => m.error !== null).length;
    const errorRate = errorCount / recent.length;

    return {
      avgLatency,
      avgCost,
      errorRate,
      totalRequests: recent.length,
    };
  }

  /**
   * Get Prometheus counters
   * @returns {Object} Prometheus counter values
   */
  getPrometheusCounters() {
    return { ...this.prometheusCounters };
  }

  /**
   * Get grouped metrics for Prometheus exposition
   * @returns {Object} Metrics grouped by provider and model
   */
  getGroupedMetrics() {
    const groups = {};
    
    for (const m of this.metrics) {
      const key = `${m.provider || 'unknown'}::${m.model || 'default'}`;
      if (!groups[key]) {
        groups[key] = {
          count: 0,
          sumLatency: 0,
          latestLatency: 0,
          errors: 0,
          sumCost: 0,
          sumTokens: 0,
        };
      }
      
      groups[key].count += 1;
      groups[key].sumLatency += Number(m.latency || 0);
      groups[key].latestLatency = Number(m.latency || 0);
      groups[key].sumCost += Number(m.cost || 0);
      groups[key].sumTokens += Number(m.totalTokens || 0);
      
      if (m.error) {
        groups[key].errors += 1;
      }
    }
    
    return groups;
  }

  /**
   * Clear all metrics (for testing)
   */
  clear() {
    this.metrics = [];
    this.prometheusCounters = {
      requests_total: 0,
      errors_total: 0,
    };
  }
}

/**
 * Singleton metrics store instance
 */
export const metricsStore = new MetricsStore();

/**
 * Create a metric entry from provider response
 * @param {Object} result - Provider response
 * @param {string} provider - Provider name
 * @param {string} model - Model name
 * @param {number} latencyMs - Request latency
 * @returns {MetricEntry} Formatted metric entry
 */
export function createMetricEntry(result, provider, model, latencyMs) {
  const usage = result.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
  
  return {
    timestamp: Date.now(),
    provider: result.provider || provider,
    model: result.model || model || 'unknown',
    latency: latencyMs,
    promptTokens: usage.prompt_tokens ?? usage.promptTokens ?? 0,
    completionTokens: usage.completion_tokens ?? usage.completionTokens ?? 0,
    totalTokens: usage.total_tokens ?? usage.totalTokens ?? 0,
    cost: result.cost ?? 0,
    error: result.error ?? null,
  };
}

/**
 * Generate demo metrics for testing
 * @returns {MetricEntry} Random demo metric
 */
export function generateDemoMetric() {
  const providers = ['demo', 'cerebras', 'llama', 'openrouter'];
  const models = ['llama3.1-8b', 'llama3.1-70b', 'gpt-4'];
  
  const latency = 50 + Math.random() * 200; // 50-250ms
  const promptTokens = Math.floor(Math.random() * 100);
  const completionTokens = Math.floor(Math.random() * 150);
  const totalTokens = promptTokens + completionTokens;
  const cost = totalTokens * 0.000001;

  return {
    timestamp: Date.now(),
    provider: providers[Math.floor(Math.random() * providers.length)],
    model: models[Math.floor(Math.random() * models.length)],
    latency,
    promptTokens,
    completionTokens,
    totalTokens,
    cost,
    error: Math.random() > 0.95 ? 'demo_error' : null, // 5% error rate
  };
}

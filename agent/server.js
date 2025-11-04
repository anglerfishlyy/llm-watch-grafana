/**
 * @fileoverview LLM Watch Agent - Main server entry point
 * @module server
 */

import express from "express";
import cors from "cors";
import { performance } from "perf_hooks";
import { config, validateConfig } from './config/index.js';
import { callProvider, getAvailableProviders } from './providers/index.js';
import { metricsStore, createMetricEntry, generateDemoMetric } from './utils/metrics.js';
import { LLMWatchError } from './utils/errors.js';

// Validate configuration on startup
validateConfig();

const app = express();

// Middleware
app.use(express.json());
if (config.server.corsEnabled) {
  app.use(cors());
}

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'healthy',
    providers: getAvailableProviders(),
    timestamp: Date.now(),
  });
});

/**
 * Main LLM call endpoint
 * Proxies requests to configured providers and records metrics
 */
app.post('/call', async (req, res) => {
  const { provider = 'cerebras', prompt = '', model } = req.body || {};
  console.log(`[${new Date().toISOString()}] POST /call - provider=${provider}, model=${model || 'default'}`);

  const start = performance.now();
  
  try {
    const result = await callProvider({ provider, prompt, model });
    const latencyMs = result.latencyMs ?? performance.now() - start;
    
    // Create and store metric entry
    const entry = createMetricEntry(result, provider, model, latencyMs);
    metricsStore.add(entry);

    // Return response
    res.json({ 
      ok: result.ok !== false, 
      metrics: entry, 
      output: result.response,
      provider: result.provider,
      model: result.model,
    });
  } catch (err) {
    const latencyMs = performance.now() - start;
    
    // Handle errors gracefully
    const errorEntry = {
      timestamp: Date.now(),
      provider,
      model: model || 'unknown',
      latency: latencyMs,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      cost: 0,
      error: err instanceof LLMWatchError ? err.message : String(err.message || err),
    };

    metricsStore.add(errorEntry);

    const statusCode = err instanceof LLMWatchError ? err.statusCode : 500;
    res.status(statusCode).json({ 
      ok: false, 
      metrics: errorEntry, 
      error: errorEntry.error,
      errorCode: err.code || 'UNKNOWN_ERROR',
    });
  }
});

/**
 * Get latest metric
 */
app.get("/metrics/latest", (req, res) => {
  console.log('[' + new Date().toISOString() + '] GET /metrics/latest');
  const latest = metricsStore.getLatest();
  res.json({ ok: true, metrics: latest });
});

/**
 * Get all metrics
 */
app.get("/metrics/all", (req, res) => {
  console.log('[' + new Date().toISOString() + '] GET /metrics/all');
  const allMetrics = metricsStore.getAll();
  res.json({ ok: true, metrics: allMetrics, count: allMetrics.length });
});

/**
 * Get aggregate statistics
 */
app.get("/metrics/aggregates", (req, res) => {
  const count = parseInt(req.query.count || '10', 10);
  const aggregates = metricsStore.getAggregates(count);
  res.json({ ok: true, aggregates, sampleSize: count });
});

/**
 * Prometheus metrics exposition endpoint
 * Exposes metrics in Prometheus text format for scraping
 */
app.get('/metrics', (req, res) => {
  if (!config.prometheus.enabled) {
    return res.status(404).json({ error: 'Prometheus metrics disabled' });
  }

  console.log('[' + new Date().toISOString() + '] GET /metrics (Prometheus scrape)');
  
  const lines = [];
  const counters = metricsStore.getPrometheusCounters();
  const groups = metricsStore.getGroupedMetrics();

  // Total requests counter
  lines.push('# HELP llm_requests_total Total number of LLM requests processed');
  lines.push('# TYPE llm_requests_total counter');
  lines.push(`llm_requests_total ${counters.requests_total}`);

  // Total errors counter
  lines.push('# HELP llm_errors_total Total number of LLM request errors');
  lines.push('# TYPE llm_errors_total counter');
  lines.push(`llm_errors_total ${counters.errors_total}`);

  // Request duration gauge
  lines.push('# HELP llm_request_duration_ms LLM request duration in milliseconds');
  lines.push('# TYPE llm_request_duration_ms gauge');

  // Request cost gauge
  lines.push('# HELP llm_request_cost_usd LLM request cost in USD');
  lines.push('# TYPE llm_request_cost_usd gauge');

  // Token usage gauge
  lines.push('# HELP llm_tokens_total Total tokens used in LLM requests');
  lines.push('# TYPE llm_tokens_total gauge');

  // Per-provider/model metrics
  for (const key of Object.keys(groups)) {
    const [provider, model] = key.split('::');
    const g = groups[key];
    const avgLatency = g.count ? g.sumLatency / g.count : 0;
    const avgCost = g.count ? g.sumCost / g.count : 0;
    
    // Latency metrics
    lines.push(`llm_request_duration_ms{provider="${provider}",model="${model}",stat="avg"} ${avgLatency.toFixed(2)}`);
    lines.push(`llm_request_duration_ms{provider="${provider}",model="${model}",stat="latest"} ${g.latestLatency}`);
    
    // Request count by success/failure
    lines.push(`llm_requests_total{provider="${provider}",model="${model}",status="success"} ${g.count - g.errors}`);
    lines.push(`llm_requests_total{provider="${provider}",model="${model}",status="error"} ${g.errors}`);
    
    // Cost metrics
    lines.push(`llm_request_cost_usd{provider="${provider}",model="${model}"} ${avgCost.toFixed(6)}`);
    
    // Token metrics
    lines.push(`llm_tokens_total{provider="${provider}",model="${model}"} ${g.sumTokens}`);
  }

  res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
  res.send(lines.join('\n') + '\n');
});

/**
 * Error handling middleware
 */
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  
  if (err instanceof LLMWatchError) {
    return res.status(err.statusCode).json(err.toJSON());
  }
  
  res.status(500).json({
    ok: false,
    error: {
      message: 'Internal server error',
      code: 'INTERNAL_ERROR',
    },
  });
});

/**
 * Start server
 */
app.listen(config.server.port, config.server.host, () => {
  console.log('='.repeat(60));
  console.log('LLM Watch Agent Started');
  console.log('='.repeat(60));
  console.log(`Server: http://${config.server.host}:${config.server.port}`);
  console.log(`Available providers: ${getAvailableProviders().join(', ')}`);
  console.log(`Prometheus metrics: ${config.prometheus.enabled ? 'enabled' : 'disabled'}`);
  console.log(`CORS: ${config.server.corsEnabled ? 'enabled' : 'disabled'}`);
  console.log('='.repeat(60));
});

export default app;

/**
 * @fileoverview MCP Gateway - Forwards LLM requests to configured providers
 * @module mcp_gateway
 */

import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';
import { config, validateConfig } from './config/index.js';
import { calculateTokens } from './tokenUtils.js';

// Validate configuration
validateConfig();

const app = express();
app.use(express.json());
app.use(cors());

const PORT = config.providers.mcp.port;

/**
 * Health check endpoint
 */
app.get('/health', (req, res) => {
  res.json({ 
    ok: true, 
    status: 'healthy',
    service: 'mcp-gateway',
    timestamp: Date.now(),
  });
});

/**
 * Forward endpoint - routes requests to appropriate provider
 */
app.post('/forward', async (req, res) => {
  const { provider = 'cerebras', model, prompt = '' } = req.body || {};
  
  console.log(`[${new Date().toISOString()}] MCP Gateway: forwarding to ${provider}, model=${model || 'default'}`);
  
  const start = Date.now();
  
  try {
    let apiUrl, apiKey, defaultModel;
    
    // Route to appropriate provider
    switch (provider) {
      case 'llama':
      case 'openrouter':
        apiUrl = config.providers.openrouter.apiUrl;
        apiKey = config.providers.openrouter.apiKey || config.providers.llama.apiKey;
        defaultModel = 'meta-llama/llama-3-8b-instruct:free';
        break;
      
      case 'cerebras':
      default:
        apiUrl = config.providers.cerebras.apiUrl;
        apiKey = config.providers.cerebras.apiKey;
        defaultModel = 'llama3.1-8b';
        break;
    }
    
    if (!apiKey) {
      return res.status(500).json({ 
        ok: false, 
        error: `API key not configured for provider: ${provider}`,
        provider,
      });
    }
    
    // Make request to provider
    const resp = await fetch(apiUrl, { 
      method: 'POST', 
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/anglerfishlyy/llm-watch-grafana',
        'X-Title': 'LLM Watch MCP Gateway',
      }, 
      body: JSON.stringify({ 
        model: model || defaultModel, 
        messages: [{ role: 'user', content: prompt }] 
      }) 
    });
    
    const latencyMs = Date.now() - start;
    
    if (!resp.ok) {
      const text = await resp.text();
      return res.status(resp.status).json({ 
        ok: false, 
        error: `Provider ${provider} returned ${resp.status}: ${text}`,
        provider,
        latencyMs,
      });
    }
    
    const json = await resp.json();
    const content = 
      json.choices?.[0]?.message?.content || 
      json.choices?.[0]?.text || 
      json.output?.[0]?.content ||
      json.result || 
      '';
    
    const usage = json.usage || {};
    const promptTokens = usage.prompt_tokens ?? calculateTokens(prompt);
    const completionTokens = usage.completion_tokens ?? calculateTokens(content);
    const totalTokens = usage.total_tokens ?? (promptTokens + completionTokens);
    
    return res.json({ 
      ok: true, 
      provider, 
      model: model || defaultModel, 
      response: content, 
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
      cost: totalTokens * 0.0000005,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - start;
    console.error('[MCP Gateway Error]', err);
    return res.status(500).json({ 
      ok: false, 
      error: err && err.message ? String(err.message) : 'gateway_error',
      provider,
      latencyMs,
    });
  }
});

/**
 * Start MCP Gateway server
 */
app.listen(PORT, '0.0.0.0', () => {
  console.log('='.repeat(60));
  console.log('MCP Gateway Started');
  console.log('='.repeat(60));
  console.log(`Server: http://0.0.0.0:${PORT}`);
  console.log(`Forward endpoint: POST /forward`);
  console.log('='.repeat(60));
});

export default app;

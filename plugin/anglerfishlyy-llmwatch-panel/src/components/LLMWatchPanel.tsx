import React, { useEffect, useState, useRef } from "react";
import { PanelProps } from "@grafana/data";
import { getDataSourceSrv, getBackendSrv } from "@grafana/runtime";
import { useTheme2, Badge } from "@grafana/ui";
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { Activity, DollarSign, Layers } from "lucide-react";

/**
 * Panel options interface
 * Defines configurable options for the LLM Watch panel
 */
export interface LLMWatchOptions {
  showSparklines: boolean;
  latencyThresholdWarning: number;
  latencyThresholdCritical: number;
  costThresholdWarning: number;
  costThresholdCritical: number;
  usePrometheus: boolean;
  promQuery: string;
}

/**
 * Default panel options
 */
const defaultOptions: LLMWatchOptions = {
  showSparklines: true,
  latencyThresholdWarning: 100,
  latencyThresholdCritical: 200,
  costThresholdWarning: 0.0001,
  costThresholdCritical: 0.0002,
  usePrometheus: false,
  promQuery: 'llm_request_duration_ms',
};


    export const LLMWatchPanel: React.FC<PanelProps<LLMWatchOptions>> = ({ options = defaultOptions, width = 600, height = 400 }) => {
      const theme = useTheme2();
      const [metricsState, setMetricsState] = useState<any[]>([]);
      const [fetchError, setFetchError] = useState<string | null>(null);
      // Provider for AI Insights generation - determines which LLM to use
      const [selectedProvider, setSelectedProvider] = useState<'cerebras' | 'llama' | 'openrouter'>('llama');
      const [insightText, setInsightText] = useState<string | null>(null);
      const [insightLoading, setInsightLoading] = useState(false);
      const [lastDataSource, setLastDataSource] = useState<'agent' | 'prometheus' | null>(null);
      const [domReady, setDomReady] = useState(false);
      const isMountedRef = useRef(true);

      const AGENT_LOCAL = 'http://localhost:8080/metrics/all';

      useEffect(() => {
        isMountedRef.current = true;

        const fetchMetrics = async () => {
          try {
            const useProxy = typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost';
            let json: any = null;
            if (useProxy) {
              try {
                const ds = await getDataSourceSrv().get('Prometheus');
                const idOrUid = (ds && (ds.uid || ds.id)) || 'Prometheus';
                const path = `/api/datasources/proxy/${idOrUid}/metrics/all`;
                json = await getBackendSrv().get(path);
                setLastDataSource('agent');
              } catch (err: any) {
                setFetchError(String(err?.message || err || 'proxy error'));
                return;
              }
            } else {
              const resp = await fetch(AGENT_LOCAL);
              if (!resp.ok) { setFetchError(`Agent returned ${resp.status}`); return; }
              json = await resp.json();
              setLastDataSource('agent');
            }

            const arr = json?.metrics || [];
            if (Array.isArray(arr)) {
              setMetricsState(arr);
              setFetchError(null); // Clear error on success
            } else {
              setFetchError('Invalid metrics payload');
            }
          } catch (err: any) {
            setFetchError(String(err?.message || err || 'fetch error'));
          }
        };

        fetchMetrics();
        const iv = setInterval(fetchMetrics, 5000);
        setDomReady(true);
        return () => { isMountedRef.current = false; clearInterval(iv); };
      }, []);

      const metrics = (metricsState || []).map((m: any) => ({
        timestamp: m.timestamp ?? m.time ?? Date.now(),
        provider: m.provider ?? 'unknown',
        model: m.model ?? 'default',
        latency: Number(m.latency ?? 0),
        promptTokens: Number(m.promptTokens ?? m.prompt_tokens ?? 0),
        completionTokens: Number(m.completionTokens ?? m.completion_tokens ?? 0),
        totalTokens: Number(m.totalTokens ?? m.total_tokens ?? m.total ?? 0),
        cost: Number(m.cost ?? 0),
        error: m.error ?? null,
      }));

      if (!metrics || metrics.length === 0) {
        return (
          <div style={{ width: width || '100%', height: height || '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', color: theme.colors.text.secondary, boxSizing: 'border-box' }}>
            <div style={{ textAlign: 'center' }}>{fetchError ? `Error: ${fetchError}` : 'No data yet'}</div>
          </div>
        );
      }

      const latest = metrics[metrics.length - 1];
      const formatted = metrics.map((m) => ({ ...m, time: new Date(m.timestamp).toLocaleTimeString() }));

      const MetricCard: React.FC<{ title: string; value: string | number; icon: React.ReactNode; color: string; subtitle?: string; warning?: boolean }> = ({ title, value, icon, color, subtitle }) => (
        <div style={{ background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border.weak}`, borderRadius: theme.shape.radius.default, padding: theme.spacing(2) }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1) }}>
            <div style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `${color}22`, borderRadius: 6 }}>{React.cloneElement(icon as React.ReactElement, { size: 18, style: { color } })}</div>
            <div>
              <div style={{ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }}>{title}</div>
              <div style={{ fontSize: theme.typography.h3.fontSize, color: theme.colors.text.primary }}>{value}</div>
              {subtitle && <div style={{ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }}>{subtitle}</div>}
            </div>
          </div>
        </div>
      );

      const containerStyle: React.CSSProperties = { width: width || '100%', height: height || '100%', display: 'flex', flexDirection: 'column', padding: 12, overflow: 'auto', boxSizing: 'border-box' };

      // Model configurations for each provider
      // NOTE: Provider name determines which API key is used from .env
      // Model ID is sent to that provider's API endpoint
      const getModelForProvider = (provider: string): string => {
        switch (provider) {
          case 'cerebras':
            // Cerebras uses CEREBRAS_API_KEY and calls api.cerebras.ai
            return 'llama3.1-8b';
          case 'llama':
            // Llama provider uses LLAMA_API_KEY (OpenRouter) and calls api.openrouter.ai
            // Using working free models from OpenRouter
            return 'meta-llama/llama-3-8b-instruct:free'; // Verified working model
          case 'openrouter':
            // OpenRouter provider uses OPENROUTER_API_KEY and calls api.openrouter.ai
            return 'google/gemma-2-9b-it:free'; // Alternative free model
          default:
            return 'llama3.1-8b';
        }
      };

      const requestInsight = async () => {
        setInsightLoading(true);
        setInsightText(null);
        
        try {
          const useProxy = typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost';
          const model = getModelForProvider(selectedProvider);
          
          // Create a summary of recent metrics for the LLM
          const metricsSummary = metrics.slice(-10).map(m => 
            `${m.provider}/${m.model}: ${m.latency}ms, ${m.totalTokens} tokens, $${m.cost.toFixed(6)}`
          ).join('\n');
          
          const payload = {
            provider: selectedProvider,
            prompt: `Analyze these LLM metrics and provide insights:\n\n${metricsSummary}\n\nProvide a brief analysis of performance, cost, and any recommendations.`,
            model: model
          };
          
          let respJson: any = null;
          
          if (useProxy) {
            respJson = await getBackendSrv().post('/api/datasources/proxy/Prometheus/call', payload);
          } else {
            const r = await fetch('http://localhost:8080/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(payload)
            });
            respJson = await r.json();
          }
          
          // Handle different response formats and errors
          if (respJson?.ok === false || respJson?.error) {
            const errorMsg = respJson?.metrics?.error || respJson?.error || 'Unknown error';
            
            // Provide user-friendly error messages
            if (errorMsg.includes('ENOTFOUND') || errorMsg.includes('getaddrinfo')) {
              setInsightText(`⚠️ Network Error: Cannot reach ${selectedProvider} API endpoint. This may be due to:\n• DNS resolution issues in Docker\n• No internet connectivity\n• Firewall blocking external requests\n\nTry: Check docker-compose.yml DNS settings or test with a different provider.`);
            } else if (errorMsg.includes('API key not configured')) {
              setInsightText(`⚠️ Configuration Error: ${errorMsg}\n\nPlease add your API key to the .env file:\n• For Cerebras: CEREBRAS_API_KEY=your_key\n• For OpenRouter/Llama: OPENROUTER_API_KEY=your_key or LLAMA_API_KEY=your_key`);
            } else {
              setInsightText(`⚠️ Error: ${errorMsg}`);
            }
          } else {
            const output = respJson?.output || respJson?.response || '';
            setInsightText(output.slice(0, 1000) || 'No response from LLM');
          }
        } catch (err: any) {
          setInsightText(`⚠️ Request Failed: ${err?.message || err || 'Unknown error'}\n\nCheck that the agent is running: http://localhost:8080/health`);
        } finally {
          setInsightLoading(false);
        }
      };

      return (
        <div style={containerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 220 }}>
              <label style={{ 
                display: 'block',
                color: theme.colors.text.secondary, 
                fontSize: theme.typography.bodySmall.fontSize,
                marginBottom: 4
              }}>
                AI Insights Provider
              </label>
              <select 
                value={selectedProvider} 
                onChange={(e) => setSelectedProvider(e.target.value as any)} 
                style={{ 
                  width: '100%',
                  padding: '6px 8px',
                  borderRadius: 4,
                  border: `1px solid ${theme.colors.border.medium}`,
                  background: theme.colors.background.primary,
                  color: theme.colors.text.primary,
                  cursor: 'pointer',
                  fontSize: theme.typography.body.fontSize
                }}
              >
                <option value="cerebras">Cerebras (llama3.1-8b)</option>
                <option value="llama">OpenRouter (Llama-3-8b) - Free</option>
                <option value="openrouter">OpenRouter (Gemma-2-9b) - Free</option>
              </select>
            </div>
            {lastDataSource && <Badge text={`data: ${lastDataSource}`} color={lastDataSource === 'agent' ? 'blue' : 'purple'} />}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 12 }}>
            <MetricCard title="Latency" value={`${latest.latency.toFixed(0)} ms`} icon={<Activity />} color={theme.visualization.getColorByName('red')} />
            <MetricCard title="Cost" value={`$${latest.cost?.toFixed?.(4) ?? '0.0000'}`} icon={<DollarSign />} color={theme.visualization.getColorByName('green')} />
            <MetricCard title="Tokens" value={`${latest.totalTokens ?? 0}`} icon={<Layers />} color={theme.visualization.getColorByName('blue')} />
          </div>

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
            {['cerebras', 'llama', 'mcp'].map((p) => {
              const list = metrics.filter((m) => m.provider === p);
              const latestP = list[list.length - 1] || null;
              const isMcp = p === 'mcp';
              
              return (
                <div key={p} style={{ 
                  minWidth: 200, 
                  padding: 12, 
                  background: theme.colors.background.secondary, 
                  border: `1px solid ${theme.colors.border.weak}`, 
                  borderRadius: 6,
                  opacity: isMcp && !latestP ? 0.6 : 1
                }}>
                  <div style={{ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }}>
                    {p.toUpperCase()}
                  </div>
                  <div style={{ fontSize: theme.typography.h3.fontSize, color: theme.colors.text.primary }}>
                    {latestP ? `${latestP.latency.toFixed(0)} ms` : (isMcp ? 'Not implemented' : '—')}
                  </div>
                  <div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>
                    {latestP ? `${latestP.totalTokens} tokens • $${latestP.cost?.toFixed?.(5) ?? '0.00000'}` : 
                     (isMcp ? 'MCP Gateway not active' : 'No data')}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: 12, background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border.weak}`, borderRadius: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.h5.fontWeight }}>
                AI Insights
              </div>
              <div>
                <button 
                  onClick={requestInsight} 
                  disabled={insightLoading} 
                  style={{ 
                    padding: '8px 16px',
                    borderRadius: 4,
                    border: 'none',
                    background: insightLoading ? theme.colors.action.disabledBackground : theme.colors.success.main,
                    color: insightLoading ? theme.colors.action.disabledText : theme.colors.success.contrastText,
                    cursor: insightLoading ? 'not-allowed' : 'pointer',
                    fontSize: theme.typography.body.fontSize,
                    fontWeight: theme.typography.fontWeightMedium,
                    transition: 'all 0.2s ease',
                    opacity: insightLoading ? 0.6 : 1
                  }}
                  onMouseEnter={(e) => {
                    if (!insightLoading) {
                      e.currentTarget.style.opacity = '0.9';
                      e.currentTarget.style.transform = 'translateY(-1px)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!insightLoading) {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.transform = 'translateY(0)';
                    }
                  }}
                >
                  {insightLoading ? '⏳ Thinking…' : '✨ Generate'}
                </button>
              </div>
            </div>
            <div style={{ 
              color: theme.colors.text.secondary, 
              minHeight: 60,
              whiteSpace: 'pre-wrap',
              fontSize: theme.typography.body.fontSize,
              lineHeight: 1.5
            }}>
              {insightText || `Click Generate to ask the ${selectedProvider} LLM for an analysis of recent metrics.`}
            </div>
          </div>

          <div style={{ padding: 12, background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border.weak}`, borderRadius: 6 }}>
            <div style={{ fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.h5.fontWeight, marginBottom: 8 }}>Token Usage Distribution</div>
            {domReady ? (
              <ResponsiveContainer width="100%" height={Math.min(280, height - 220)}>
                <BarChart data={formatted}>
                  <CartesianGrid stroke={theme.colors.border.weak} strokeDasharray="3 3" />
                  <XAxis dataKey="time" stroke={theme.colors.text.secondary} tick={{ fill: theme.colors.text.secondary }} />
                  <YAxis stroke={theme.colors.text.secondary} tick={{ fill: theme.colors.text.secondary }} />
                  <Tooltip contentStyle={{ backgroundColor: theme.colors.background.primary, borderColor: theme.colors.border.medium, color: theme.colors.text.primary, borderRadius: theme.shape.radius.default, fontSize: theme.typography.bodySmall.fontSize }} />
                  <Legend wrapperStyle={{ fontSize: theme.typography.bodySmall.fontSize, fontWeight: theme.typography.fontWeightMedium }} />
                  <Bar dataKey="promptTokens" fill={theme.visualization.getColorByName('blue')} radius={[4, 4, 0, 0]} />
                  <Bar dataKey="completionTokens" fill={theme.visualization.getColorByName('green')} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ color: theme.colors.text.secondary }}>Preparing chart…</div>
            )}
          </div>
        </div>
      );
    };

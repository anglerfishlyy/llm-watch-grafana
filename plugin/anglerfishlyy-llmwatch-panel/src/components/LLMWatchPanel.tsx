import React, { useEffect, useState, useRef } from "react";
import { PanelProps, PanelPlugin, dateTime } from "@grafana/data";
import { getDataSourceSrv, getBackendSrv } from "@grafana/runtime";
import { useTheme2, Badge } from "@grafana/ui";
import { ResponsiveContainer, LineChart, Line, AreaChart, Area, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, Activity, DollarSign, Layers } from "lucide-react";

// Define panel options interface
interface LLMWatchOptions {
  showSparklines: boolean;
  latencyThresholdWarning: number;
  latencyThresholdCritical: number;
  costThresholdWarning: number;
  costThresholdCritical: number;
}

// Default options
const defaultOptions: LLMWatchOptions = {
  showSparklines: true,
  latencyThresholdWarning: 100,
  latencyThresholdCritical: 200,
  costThresholdWarning: 0.0001,
  costThresholdCritical: 0.0002,
};


    export const LLMWatchPanel: React.FC<PanelProps<LLMWatchOptions>> = ({ options = defaultOptions, width = 600, height = 400 }) => {
      const theme = useTheme2();
      const [metricsState, setMetricsState] = useState<any[]>([]);
      const [fetchError, setFetchError] = useState<string | null>(null);
      const [selectedProvider, setSelectedProvider] = useState<'all' | 'cerebras' | 'llama' | 'mcp'>('all');
      const [insightText, setInsightText] = useState<string | null>(null);
      const [insightLoading, setInsightLoading] = useState(false);
      const [lastDataSource, setLastDataSource] = useState<'agent' | 'prometheus' | null>(null);
      const [domReady, setDomReady] = useState(false);
      const isMountedRef = useRef(true);

      const AGENT_LOCAL = 'http://localhost:8080/metrics/all';

      useEffect(() => {
        isMountedRef.current = true;
        let mounted = true;

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
            if (Array.isArray(arr)) setMetricsState(arr);
            else setFetchError('Invalid metrics payload');
          } catch (err: any) {
            setFetchError(String(err?.message || err || 'fetch error'));
          }
        };

        fetchMetrics();
        const iv = setInterval(fetchMetrics, 5000);
        setDomReady(true);
        return () => { mounted = false; isMountedRef.current = false; clearInterval(iv); };
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

      const requestInsight = async () => {
        setInsightLoading(true); setInsightText(null);
        try {
          const useProxy = typeof window !== 'undefined' && window.location && window.location.hostname !== 'localhost';
          const payload = { provider: 'llama', prompt: `Summarize recent metrics:\n${metrics.slice(-10).map(m => `${m.provider}/${m.model}: ${m.latency}ms`).join('\n')}`, model: 'llama-3-8b-chat' };
          let respJson: any = null;
          if (useProxy) { respJson = await getBackendSrv().post('/api/datasources/proxy/Prometheus/call', payload); }
          else { const r = await fetch('http://localhost:8080/call', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) }); respJson = await r.json(); }
          setInsightText(String(respJson?.output || respJson?.response || JSON.stringify(respJson)).slice(0, 800));
        } catch (err: any) { setInsightText(String(err?.message || err || 'error')); } finally { setInsightLoading(false); }
      };

      return (
        <div style={containerStyle}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <div style={{ minWidth: 220 }}>
              <label style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>Provider</label>
              <select value={selectedProvider} onChange={(e) => setSelectedProvider(e.target.value as any)} style={{ width: '100%', marginTop: 6 }}>
                <option value="all">All (combined)</option>
                <option value="cerebras">Cerebras</option>
                <option value="llama">Meta Llama</option>
                <option value="mcp">MCP Gateway</option>
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
              return (
                <div key={p} style={{ minWidth: 200, padding: 12, background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border.weak}`, borderRadius: 6 }}>
                  <div style={{ fontSize: theme.typography.bodySmall.fontSize, color: theme.colors.text.secondary }}>{p.toUpperCase()}</div>
                  <div style={{ fontSize: theme.typography.h3.fontSize, color: theme.colors.text.primary }}>{latestP ? `${latestP.latency.toFixed(0)} ms` : '—'}</div>
                  <div style={{ color: theme.colors.text.secondary }}>{latestP ? `${latestP.totalTokens} tokens • $${latestP.cost?.toFixed?.(5) ?? '0.00000'}` : ''}</div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: 12, background: theme.colors.background.secondary, border: `1px solid ${theme.colors.border.weak}`, borderRadius: 6, marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: theme.typography.h5.fontSize, fontWeight: theme.typography.h5.fontWeight }}>AI Insights</div>
              <div>
                <button onClick={requestInsight} disabled={insightLoading} style={{ padding: '6px 10px', borderRadius: 4 }}>{insightLoading ? 'Thinking…' : 'Generate'}</button>
              </div>
            </div>
            <div style={{ color: theme.colors.text.secondary, minHeight: 60 }}>{insightText || 'Click Generate to ask the LLM for a summary of recent metrics.'}</div>
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

    export const plugin = new PanelPlugin<LLMWatchOptions>(LLMWatchPanel).setPanelOptions((builder) => {
      return builder
        .addBooleanSwitch({ path: 'showSparklines', name: 'Show sparklines', description: 'Display mini trend charts in metric cards', defaultValue: defaultOptions.showSparklines })
        .addNumberInput({ path: 'latencyThresholdWarning', name: 'Latency warning threshold (ms)', description: 'Show warning color when latency exceeds this value', defaultValue: defaultOptions.latencyThresholdWarning })
        .addNumberInput({ path: 'latencyThresholdCritical', name: 'Latency critical threshold (ms)', description: 'Show critical color and alert when latency exceeds this value', defaultValue: defaultOptions.latencyThresholdCritical })
        .addNumberInput({ path: 'costThresholdWarning', name: 'Cost warning threshold ($)', description: 'Show warning color when cost exceeds this value', defaultValue: defaultOptions.costThresholdWarning, settings: { step: 0.00001 } })
        .addNumberInput({ path: 'costThresholdCritical', name: 'Cost critical threshold ($)', description: 'Show critical color and alert when cost exceeds this value', defaultValue: defaultOptions.costThresholdCritical, settings: { step: 0.00001 } });
    });
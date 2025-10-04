import React, { useEffect, useState } from "react";
import { DataQueryRequest, DataQueryResponse } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';
import { dateTime } from '@grafana/data';
import { PanelProps, PanelPlugin } from "@grafana/data";
import { useTheme2, Badge } from "@grafana/ui";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  Area,
  AreaChart,
} from "recharts";
import { TrendingUp, TrendingDown, AlertCircle, Activity, DollarSign, Layers } from "lucide-react";

interface LLMWatchOptions {
  showSparklines: boolean;
  latencyThresholdWarning: number;
  latencyThresholdCritical: number;
  costThresholdWarning: number;
  costThresholdCritical: number;
}

const defaultOptions: LLMWatchOptions = {
  showSparklines: true,
  latencyThresholdWarning: 100,
  latencyThresholdCritical: 200,
  costThresholdWarning: 0.0001,
  costThresholdCritical: 0.0002,
};

export const LLMWatchPanel: React.FC<PanelProps<LLMWatchOptions>> = ({ 
  options, 
  data, 
  width, 
  height 
}) => {
  const theme = useTheme2();

  // Fetch live metrics from the agent backend (inside Docker use service name 'agent')
  const [metricsState, setMetricsState] = useState<any[]>([]);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const fetchMetrics = async () => {
      const endpoints = [
        'http://agent:8080/metrics/all',
        'http://localhost:8080/metrics/all',
      ];

      for (const url of endpoints) {
        try {
          const resp = await fetch(url);
          if (!resp.ok) continue;
          const json = await resp.json();
          const arr = json.metrics || [];
          if (Array.isArray(arr)) {
            if (mounted) {
              setMetricsState(arr);
              setFetchError(null);
            }
            return;
          }
        } catch (err) {
          // try the next endpoint
        }
      }
      if (mounted) setFetchError('Error fetching metrics');
    };

    fetchMetrics();
    const iv = setInterval(fetchMetrics, 5000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, []);

  // normalize fetched metrics to expected shape
  const metrics: any[] = (metricsState || []).map((m: any) => ({
    timestamp: m.timestamp ?? m.time ?? Date.now(),
    provider: m.provider ?? 'unknown',
    latency: Number(m.latency ?? 0),
    promptTokens: Number(m.promptTokens ?? m.prompt_tokens ?? 0),
    completionTokens: Number(m.completionTokens ?? m.completion_tokens ?? 0),
    totalTokens: Number(m.totalTokens ?? m.total_tokens ?? m.total ?? 0),
    cost: Number(m.cost ?? 0),
    error: m.error ?? null,
  }));

  // Prometheus series (via Grafana datasource) for rate queries
  const [promSeries, setPromSeries] = useState<{ timestamp: number; rate: number }[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchViaDatasource = async (expr: string) => {
      try {
        const ds = await getDataSourceSrv().get('Prometheus');
        const now = dateTime();
        const range = { from: now.clone().subtract(5, 'm'), to: now } as any;

        const query: DataQueryRequest = {
          targets: [{ expr, refId: 'A' } as any],
          range,
        } as any;

        const res = (await ds.query(query)) as DataQueryResponse;
        // parse the first series values
        const frame = res.data?.[0];
        if (frame && frame.fields) {
          // assume the second field contains values
          const valuesField = frame.fields[1];
          const times = frame.fields[0];
          if (valuesField && times) {
            const vals = valuesField.values.toArray();
            const timesArr = times.values.toArray();
            const series = vals.map((v: any, i: number) => ({ timestamp: Number(timesArr[i]), rate: Number(v) }));
            if (mounted) setPromSeries(series);
            return;
          }
        }
        if (mounted) setPromSeries([]);
      } catch (err) {
        if (mounted) setPromSeries([]);
      }
    };

    if (options && (options as any).usePrometheus) {
      const expr = (options as any).promQuery || 'rate(http_requests_total[5m])';
      fetchViaDatasource(expr);
      const iv = setInterval(() => fetchViaDatasource(expr), 5000);
      return () => {
        mounted = false;
        clearInterval(iv);
      };
    }
    return () => { mounted = false; };
  }, [options]);

  if (!metrics || metrics.length === 0) {
    return (
      <div 
        style={{ 
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
          color: theme.colors.text.secondary,
        }}
      >
        <div style={{ textAlign: 'center' }}>{fetchError ? 'Error fetching metrics' : 'No data yet'}</div>
      </div>
    );
  }

  if (metrics.length === 0) {
    return (
      <div 
        style={{ 
          width,
          height,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'transparent',
        }}
      >
        <div style={{ textAlign: 'center', color: theme.colors.text.secondary }}>
          No metric data available
        </div>
      </div>
    );
  }

  const latest = metrics[metrics.length - 1];
  const formatted = metrics.map((m) => ({
    ...m,
    time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

  const formattedProm = promSeries.map((p) => ({
    time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    rate: p.rate,
  }));

  // Calculate aggregates from last 10 records
  const last10 = metrics.slice(-10);
  const aggregates = {
    avgLatency: last10.reduce((sum, m) => sum + m.latency, 0) / last10.length,
    avgCost: last10.reduce((sum, m) => sum + m.cost, 0) / last10.length,
    errorRate: last10.filter(m => m.error).length / last10.length,
  };

  const getColor = (val: number, thresholds: [number, number]) => {
    if (val > thresholds[1]) return theme.visualization.getColorByName('red');
    if (val > thresholds[0]) return theme.visualization.getColorByName('orange');
    return theme.visualization.getColorByName('green');
  };

  const getTrend = (current: number, previous: number) => {
    if (!previous) return null;
    const change = ((current - previous) / previous) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      isUp: change > 0,
      color: change > 0 ? theme.visualization.getColorByName('red') : theme.visualization.getColorByName('green')
    };
  };

  const prevLatency = metrics.length > 1 ? metrics[metrics.length - 2].latency : latest.latency;
  const prevCost = metrics.length > 1 ? metrics[metrics.length - 2].cost : latest.cost;
  
  const latencyTrend = getTrend(latest.latency, prevLatency);
  const costTrend = getTrend(latest.cost, prevCost);

  // Responsive sizing based on Grafana standards
  const showSparklines = options.showSparklines && height >= 200;
  const showCharts = height > 350;
  const showAggregates = height > 250;

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    sparkKey?: string;
    color: string;
    trend?: { value: string; isUp: boolean; color: string } | null;
    subtitle?: string;
    warning?: boolean;
  }> = ({ title, value, icon, sparkKey, color, trend, subtitle, warning }) => (
    <div
      style={{
        background: theme.colors.background.secondary,
        border: `1px solid ${warning ? theme.visualization.getColorByName('red') : theme.colors.border.weak}`,
        borderRadius: theme.shape.radius.default,
        padding: theme.spacing(2),
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        transition: 'all 0.2s ease',
      }}
    >
      <div style={{ 
        display: 'flex', 
        alignItems: 'flex-start', 
        justifyContent: 'space-between',
        marginBottom: theme.spacing(1.5)
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: theme.spacing(1.5), flex: 1, minWidth: 0 }}>
          <div 
            style={{ 
              background: `${color}15`,
              padding: theme.spacing(1),
              borderRadius: theme.shape.radius.default,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            {React.cloneElement(icon as React.ReactElement, { 
              size: 20, 
              style: { color } 
            })}
          </div>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div style={{ 
              fontSize: theme.typography.bodySmall.fontSize,
              fontWeight: theme.typography.fontWeightMedium,
              color: theme.colors.text.secondary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              fontFamily: theme.typography.fontFamily
            }}>
              {title}
            </div>
            {subtitle && (
              <div style={{ 
                fontSize: theme.typography.bodySmall.fontSize,
                color: theme.colors.text.disabled,
                fontFamily: theme.typography.fontFamily
              }}>
                {subtitle}
              </div>
            )}
          </div>
        </div>
        {warning && (
          <Badge 
            text="Alert"
            color="red" 
            icon="exclamation-triangle"
            style={{ flexShrink: 0 }}
          />
        )}
      </div>
      
      <div style={{ 
        display: 'flex', 
        alignItems: 'baseline', 
        justifyContent: 'space-between',
        marginBottom: showSparklines && sparkKey ? theme.spacing(1.5) : 0,
        gap: theme.spacing(2)
      }}>
        <div style={{ 
          fontSize: theme.typography.h2.fontSize,
          fontWeight: theme.typography.h2.fontWeight,
          color: color,
          lineHeight: theme.typography.h2.lineHeight,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: theme.typography.fontFamily
        }}>
          {value}
        </div>
        {trend && (
          <div 
            style={{ 
              display: 'flex',
              alignItems: 'center',
              gap: theme.spacing(0.5),
              fontSize: theme.typography.bodySmall.fontSize,
              color: trend.color,
              fontWeight: theme.typography.fontWeightMedium,
              flexShrink: 0,
              fontFamily: theme.typography.fontFamily
            }}
          >
            {trend.isUp ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
            {trend.value}%
          </div>
        )}
      </div>

      {sparkKey && showSparklines && (
        <div style={{ height: 60, marginTop: 'auto' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={formatted}>
              <defs>
                <linearGradient id={`gradient-${sparkKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.4}/>
                  <stop offset="95%" stopColor={color} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area 
                type="monotone" 
                dataKey={sparkKey} 
                stroke={color} 
                strokeWidth={2} 
                fill={`url(#gradient-${sparkKey})`}
                dot={false} 
                isAnimationActive={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );

  const latencyColor = getColor(latest.latency, [options.latencyThresholdWarning, options.latencyThresholdCritical]);
  const costColor = getColor(latest.cost, [options.costThresholdWarning, options.costThresholdCritical]);

  return (
    <div style={{ 
      width,
      height,
      padding: theme.spacing(2),
      background: 'transparent',
      overflowY: 'auto',
      overflowX: 'auto',
      fontFamily: theme.typography.fontFamily
    }}>
      {/* Primary Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: latest.error ? 'repeat(4, minmax(220px, 1fr))' : 'repeat(3, minmax(220px, 1fr))',
        gap: theme.spacing(2),
        marginBottom: theme.spacing(2),
        minWidth: latest.error ? '920px' : '700px'
      }}>
        <MetricCard
          title="Response Latency"
          value={`${latest.latency.toFixed(0)} ms`}
          subtitle="milliseconds"
          icon={<Activity />}
          sparkKey="latency"
          color={latencyColor}
          warning={latest.latency > options.latencyThresholdCritical}
          trend={latencyTrend}
        />
        <MetricCard
          title="Request Cost"
          value={`$${latest.cost.toFixed(4)}`}
          icon={<DollarSign />}
          sparkKey="cost"
          color={costColor}
          warning={latest.cost > options.costThresholdCritical}
          trend={costTrend}
        />
        <MetricCard 
          title="Total Tokens" 
          value={latest.totalTokens.toLocaleString()} 
          icon={<Layers />}
          sparkKey="totalTokens"
          color={theme.visualization.getColorByName('blue')}
        />
        {latest.error && (
          <MetricCard 
            title="Error Status" 
            value={latest.error}
            icon={<AlertCircle />}
            color={theme.visualization.getColorByName('red')}
            warning
          />
        )}
      </div>

      {/* Aggregate Stats */}
      {showAggregates && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, minmax(200px, 1fr))',
          gap: theme.spacing(2),
          marginBottom: theme.spacing(2),
          minWidth: '620px'
        }}>
          <div style={{
            padding: theme.spacing(2),
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.radius.default,
          }}>
            <div style={{ 
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.text.secondary,
              fontWeight: theme.typography.fontWeightMedium,
              marginBottom: theme.spacing(1),
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Avg Latency (10)
            </div>
            <div style={{ 
              fontSize: theme.typography.h3.fontSize,
              fontWeight: theme.typography.h3.fontWeight,
              color: theme.colors.text.primary,
              fontFamily: theme.typography.fontFamily
            }}>
              {aggregates.avgLatency.toFixed(0)} <span style={{ 
                fontSize: theme.typography.body.fontSize,
                color: theme.colors.text.secondary 
              }}>ms</span>
            </div>
          </div>
          <div style={{
            padding: theme.spacing(2),
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.radius.default,
          }}>
            <div style={{ 
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.text.secondary,
              fontWeight: theme.typography.fontWeightMedium,
              marginBottom: theme.spacing(1),
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Avg Cost (10)
            </div>
            <div style={{ 
              fontSize: theme.typography.h3.fontSize,
              fontWeight: theme.typography.h3.fontWeight,
              color: theme.colors.text.primary,
              fontFamily: theme.typography.fontFamily
            }}>
              ${aggregates.avgCost.toFixed(5)}
            </div>
          </div>
          <div style={{
            padding: theme.spacing(2),
            background: theme.colors.background.secondary,
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.radius.default,
          }}>
            <div style={{ 
              fontSize: theme.typography.bodySmall.fontSize,
              color: theme.colors.text.secondary,
              fontWeight: theme.typography.fontWeightMedium,
              marginBottom: theme.spacing(1),
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Error Rate
            </div>
            <div style={{ 
              fontSize: theme.typography.h3.fontSize,
              fontWeight: theme.typography.h3.fontWeight,
              color: aggregates.errorRate > 0 
                ? theme.visualization.getColorByName('red') 
                : theme.visualization.getColorByName('green'),
              fontFamily: theme.typography.fontFamily
            }}>
              {(aggregates.errorRate * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      )}

      {/* Charts */}
      {showCharts && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: height > 500 ? 'repeat(2, minmax(400px, 1fr))' : '1fr',
          gap: theme.spacing(2),
          minWidth: height > 500 ? '820px' : '400px'
        }}>
          <div style={{ 
            padding: theme.spacing(2),
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.radius.default,
            background: theme.colors.background.secondary,
          }}>
            <h3 style={{ 
              fontSize: theme.typography.h5.fontSize,
              fontWeight: theme.typography.h5.fontWeight,
              marginBottom: theme.spacing(2),
              color: theme.colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Prometheus: http_requests_total rate (5m)
            </h3>
            <ResponsiveContainer width="100%" height={Math.min(140, Math.floor((height - 350) / 2))}>
              <LineChart data={formattedProm}>
                <CartesianGrid stroke={theme.colors.border.weak} strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke={theme.colors.text.secondary} tick={{ fill: theme.colors.text.secondary }} />
                <YAxis stroke={theme.colors.text.secondary} tick={{ fill: theme.colors.text.secondary }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.colors.background.primary,
                    borderColor: theme.colors.border.medium,
                    color: theme.colors.text.primary,
                    borderRadius: theme.shape.radius.default,
                    fontSize: theme.typography.bodySmall.fontSize,
                    fontFamily: theme.typography.fontFamily
                  }}
                />
                <Line type="monotone" dataKey="rate" stroke={theme.visualization.getColorByName('blue')} dot={false} isAnimationActive={false} strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>

            <h3 style={{ 
              fontSize: theme.typography.h5.fontSize,
              fontWeight: theme.typography.h5.fontWeight,
              marginTop: theme.spacing(2),
              marginBottom: theme.spacing(2),
              color: theme.colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Latency Trend
            </h3>
            <ResponsiveContainer width="100%" height={Math.min(140, Math.floor((height - 350) / 2))}>
              <LineChart data={formatted}>
                <defs>
                  <linearGradient id="latencyGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.visualization.getColorByName('red')} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={theme.visualization.getColorByName('red')} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.colors.border.weak} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  stroke={theme.colors.text.secondary}
                  style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                  tick={{ fill: theme.colors.text.secondary }}
                />
                <YAxis 
                  stroke={theme.colors.text.secondary}
                  style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                  tick={{ fill: theme.colors.text.secondary }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.colors.background.primary,
                    borderColor: theme.colors.border.medium,
                    color: theme.colors.text.primary,
                    borderRadius: theme.shape.radius.default,
                    fontSize: theme.typography.bodySmall.fontSize,
                    fontFamily: theme.typography.fontFamily
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="latency" 
                  stroke={theme.visualization.getColorByName('red')} 
                  strokeWidth={2.5}
                  fill="url(#latencyGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div style={{ 
            padding: theme.spacing(2),
            border: `1px solid ${theme.colors.border.weak}`,
            borderRadius: theme.shape.radius.default,
            background: theme.colors.background.secondary,
          }}>
            <h3 style={{ 
              fontSize: theme.typography.h5.fontSize,
              fontWeight: theme.typography.h5.fontWeight,
              marginBottom: theme.spacing(2),
              color: theme.colors.text.primary,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontFamily: theme.typography.fontFamily
            }}>
              Cost Trend
            </h3>
            <ResponsiveContainer width="100%" height={Math.min(280, height - 350)}>
              <LineChart data={formatted}>
                <defs>
                  <linearGradient id="costGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={theme.visualization.getColorByName('green')} stopOpacity={0.4}/>
                    <stop offset="95%" stopColor={theme.visualization.getColorByName('green')} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={theme.colors.border.weak} strokeDasharray="3 3" />
                <XAxis 
                  dataKey="time" 
                  stroke={theme.colors.text.secondary}
                  style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                  tick={{ fill: theme.colors.text.secondary }}
                />
                <YAxis 
                  stroke={theme.colors.text.secondary}
                  style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                  tick={{ fill: theme.colors.text.secondary }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.colors.background.primary,
                    borderColor: theme.colors.border.medium,
                    color: theme.colors.text.primary,
                    borderRadius: theme.shape.radius.default,
                    fontSize: theme.typography.bodySmall.fontSize,
                    fontFamily: theme.typography.fontFamily
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="cost" 
                  stroke={theme.visualization.getColorByName('green')} 
                  strokeWidth={2.5}
                  fill="url(#costGradient)"
                  dot={false}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {height > 550 && (
            <div style={{ 
              padding: theme.spacing(2),
              border: `1px solid ${theme.colors.border.weak}`,
              borderRadius: theme.shape.radius.default,
              background: theme.colors.background.secondary,
              gridColumn: '1 / -1'
            }}>
              <h3 style={{ 
                fontSize: theme.typography.h5.fontSize,
                fontWeight: theme.typography.h5.fontWeight,
                marginBottom: theme.spacing(2),
                color: theme.colors.text.primary,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                fontFamily: theme.typography.fontFamily
              }}>
                Token Usage Distribution
              </h3>
              <ResponsiveContainer width="100%" height={Math.min(280, height - 500)}>
                <BarChart data={formatted}>
                  <CartesianGrid stroke={theme.colors.border.weak} strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="time" 
                    stroke={theme.colors.text.secondary}
                    style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                    tick={{ fill: theme.colors.text.secondary }}
                  />
                  <YAxis 
                    stroke={theme.colors.text.secondary}
                    style={{ fontSize: theme.typography.bodySmall.fontSize, fontFamily: theme.typography.fontFamily }}
                    tick={{ fill: theme.colors.text.secondary }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: theme.colors.background.primary,
                      borderColor: theme.colors.border.medium,
                      color: theme.colors.text.primary,
                      borderRadius: theme.shape.radius.default,
                      fontSize: theme.typography.bodySmall.fontSize,
                      fontFamily: theme.typography.fontFamily
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ 
                      fontSize: theme.typography.bodySmall.fontSize,
                      fontWeight: theme.typography.fontWeightMedium,
                      fontFamily: theme.typography.fontFamily
                    }}
                  />
                  <Bar 
                    dataKey="promptTokens" 
                    fill={theme.visualization.getColorByName('blue')} 
                    radius={[4, 4, 0, 0]} 
                  />
                  <Bar 
                    dataKey="completionTokens" 
                    fill={theme.visualization.getColorByName('green')} 
                    radius={[4, 4, 0, 0]} 
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const plugin = new PanelPlugin<LLMWatchOptions>(LLMWatchPanel).setPanelOptions((builder) => {
  return builder
    .addBooleanSwitch({
      path: 'showSparklines',
      name: 'Show sparklines',
      description: 'Display mini trend charts in metric cards',
      defaultValue: defaultOptions.showSparklines,
    })
    .addNumberInput({
      path: 'latencyThresholdWarning',
      name: 'Latency warning threshold (ms)',
      description: 'Show warning color when latency exceeds this value',
      defaultValue: defaultOptions.latencyThresholdWarning,
    })
    .addNumberInput({
      path: 'latencyThresholdCritical',
      name: 'Latency critical threshold (ms)',
      description: 'Show critical color and alert when latency exceeds this value',
      defaultValue: defaultOptions.latencyThresholdCritical,
    })
    .addNumberInput({
      path: 'costThresholdWarning',
      name: 'Cost warning threshold ($)',
      description: 'Show warning color when cost exceeds this value',
      defaultValue: defaultOptions.costThresholdWarning,
      settings: {
        step: 0.00001,
      },
    })
    .addNumberInput({
      path: 'costThresholdCritical',
      name: 'Cost critical threshold ($)',
      description: 'Show critical color and alert when cost exceeds this value',
      defaultValue: defaultOptions.costThresholdCritical,
      settings: {
        step: 0.00001,
      },
    });
});
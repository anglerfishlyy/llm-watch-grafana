import React, { useEffect, useState } from "react";
import { PanelProps, PanelPlugin } from "@grafana/data";
import { useTheme2, Badge } from "@grafana/ui";
import {
  LineChart,
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

interface Metrics {
  timestamp: number;
  latency: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  cost: number;
  error: string | null;
}

interface Aggregates {
  avgLatency: number;
  avgCost: number;
  errorRate: number;
}

export const LLMWatchPanel: React.FC<PanelProps> = ({ width, height }) => {
  const theme = useTheme2();
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        const [metricsRes, aggRes] = await Promise.all([
          fetch("http://localhost:8080/metrics/all"),
          fetch("http://localhost:8080/metrics/aggregates"),
        ]);
        setMetrics(await metricsRes.json());
        setAggregates(await aggRes.json());
      } catch (err) {
        console.error(err);
      }
    };
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!metrics.length) {
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
        <div style={{ textAlign: 'center' }}>
          <Activity 
            size={64} 
            style={{ 
              margin: '0 auto 16px',
              color: theme.colors.text.secondary,
              animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite'
            }}
          />
          <div style={{ 
            color: theme.colors.text.secondary, 
            fontSize: theme.typography.h5.fontSize,
            fontFamily: theme.typography.fontFamily 
          }}>
            Loading metrics...
          </div>
        </div>
      </div>
    );
  }

  const latest = metrics[metrics.length - 1];
  const formatted = metrics.map((m) => ({
    ...m,
    time: new Date(m.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  }));

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
  const showSparklines = height >= 200;
  const showCharts = height > 350;
  const showAggregates = height > 250;

  const MetricCard: React.FC<{
    title: string;
    value: string | number;
    icon: React.ReactNode;
    sparkKey?: keyof Metrics;
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

  const latencyColor = getColor(latest.latency, [100, 200]);
  const costColor = getColor(latest.cost, [0.0001, 0.0002]);

  return (
    <div style={{ 
      width,
      height,
      padding: theme.spacing(2),
      background: 'transparent',
      overflowY: 'auto',
      overflowX: 'hidden',
      fontFamily: theme.typography.fontFamily
    }}>
      {/* Primary Metrics */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: latest.error ? 'repeat(auto-fit, minmax(220px, 1fr))' : 'repeat(3, 1fr)',
        gap: theme.spacing(2),
        marginBottom: theme.spacing(2)
      }}>
        <MetricCard
          title="Response Latency"
          value={`${latest.latency.toFixed(0)} ms`}
          subtitle="milliseconds"
          icon={<Activity />}
          sparkKey="latency"
          color={latencyColor}
          warning={latest.latency > 200}
          trend={latencyTrend}
        />
        <MetricCard
          title="Request Cost"
          value={`$${latest.cost.toFixed(4)}`}
          icon={<DollarSign />}
          sparkKey="cost"
          color={costColor}
          warning={latest.cost > 0.0002}
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
      {aggregates && showAggregates && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: theme.spacing(2),
          marginBottom: theme.spacing(2)
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
          gridTemplateColumns: height > 500 ? 'repeat(2, 1fr)' : '1fr',
          gap: theme.spacing(2)
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
              Latency Trend
            </h3>
            <ResponsiveContainer width="100%" height={Math.min(280, height - 350)}>
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

export const plugin = new PanelPlugin(LLMWatchPanel);
import React, { useEffect, useState } from "react";
import { PanelProps, PanelPlugin } from "@grafana/data";
import { useTheme2, Card, Button, Badge } from "@grafana/ui";
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
} from "recharts";

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

export const LLMWatchPanel: React.FC<PanelProps> = () => {
  const theme = useTheme2();
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);
  const [showLatencyWarning, setShowLatencyWarning] = useState(false);
  const [showCostWarning, setShowCostWarning] = useState(false);

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

  if (!metrics.length) return <div className="h-64 flex items-center justify-center text-gray-500">Loading...</div>;

  const latest = metrics[metrics.length - 1];
  const formatted = metrics.map((m) => ({ ...m, time: new Date(m.timestamp).toLocaleTimeString() }));

  const getColor = (val: number, thresholds: [number, number]) =>
    val > thresholds[1] ? "#ef4444" : val > thresholds[0] ? "#f59e0b" : "#10b981";

  const CompactCard: React.FC<{
    title: string;
    value: string | number;
    sparkKey?: keyof Metrics;
    color?: string;
    warning?: string;
    showWarning?: boolean;
    toggleWarning?: () => void;
  }> = ({ title, value, sparkKey, color = "#4f46e5", warning, showWarning, toggleWarning }) => (
    <Card
      style={{
        background: theme.isDark ? "#1e1e1e" : "#fff",
        border: `1px solid ${theme.isDark ? "#333" : "#ddd"}`,
        padding: "0.75rem",
      }}
    >
      <div className="flex items-center justify-between text-xs font-semibold">
        {title}
        {warning && toggleWarning && (
          <Button size="sm" variant="secondary" onClick={toggleWarning}>
            !
          </Button>
        )}
      </div>
      <div className="text-lg font-bold" style={{ color }}>
        {value}
      </div>
      {sparkKey && (
        <ResponsiveContainer width="100%" height={30}>
          <LineChart data={formatted}>
            <Line type="monotone" dataKey={sparkKey} stroke={color} strokeWidth={2} dot={false} isAnimationActive />
          </LineChart>
        </ResponsiveContainer>
      )}
      {showWarning && warning && (
  <Badge color="red" style={{ marginTop: 2 }}>
    {warning}
  </Badge>
)}

    </Card>
  );

  return (
    <div className="space-y-4">
      {/* Top Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2">
        <CompactCard
          title="Latency (ms)"
          value={latest.latency.toFixed(2)}
          sparkKey="latency"
          color={getColor(latest.latency, [100, 200])}
          warning="High Latency!"
          showWarning={showLatencyWarning}
          toggleWarning={() => setShowLatencyWarning(!showLatencyWarning)}
        />
        <CompactCard
          title="Cost ($)"
          value={latest.cost.toFixed(6)}
          sparkKey="cost"
          color={getColor(latest.cost, [0.0001, 0.0002])}
          warning="High Cost!"
          showWarning={showCostWarning}
          toggleWarning={() => setShowCostWarning(!showCostWarning)}
        />
        <CompactCard title="Total Tokens" value={latest.totalTokens} sparkKey="totalTokens" />
        {latest.error && <CompactCard title="Error" value={latest.error} color="#ef4444" />}
      </div>

      {/* Aggregates */}
      {aggregates && (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          <CompactCard title="Avg Latency (last 10)" value={`${aggregates.avgLatency.toFixed(2)} ms`} />
          <CompactCard title="Avg Cost (last 10)" value={`$${aggregates.avgCost.toFixed(6)}`} />
          <CompactCard title="Error Rate" value={`${(aggregates.errorRate * 100).toFixed(2)}%`} />
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        <CompactChart title="Latency Trend" dataKey="latency" formatted={formatted} color="#ef4444" theme={theme} />
        <CompactChart title="Cost Trend" dataKey="cost" formatted={formatted} color="#10b981" theme={theme} />
        <div className="md:col-span-2">
          <Card style={{ padding: "0.75rem", border: `1px solid ${theme.isDark ? "#333" : "#ddd"}` }}>
            <h3 className="text-sm font-semibold mb-1">Token Usage</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={formatted}>
                <CartesianGrid stroke={theme.isDark ? "#333" : "#eee"} strokeDasharray="3 3" />
                <XAxis dataKey="time" stroke={theme.isDark ? "#bbb" : "#666"} />
                <YAxis stroke={theme.isDark ? "#bbb" : "#666"} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: theme.isDark ? "#1f1f1f" : "#fff",
                    borderColor: theme.isDark ? "#444" : "#ddd",
                    color: theme.isDark ? "#fff" : "#111",
                  }}
                />
                <Legend />
                <Bar dataKey="promptTokens" fill="#4f46e5" />
                <Bar dataKey="completionTokens" fill="#10b981" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
};

interface CompactChartProps {
  title: string;
  dataKey: keyof Metrics;
  formatted: any[];
  color: string;
  theme: any;
}
const CompactChart: React.FC<CompactChartProps> = ({ title, dataKey, formatted, color, theme }) => (
  <Card style={{ padding: "0.75rem", border: `1px solid ${theme.isDark ? "#333" : "#ddd"}` }}>
    <h3 className="text-sm font-semibold mb-1">{title}</h3>
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={formatted}>
        <CartesianGrid stroke={theme.isDark ? "#333" : "#eee"} strokeDasharray="3 3" />
        <XAxis dataKey="time" stroke={theme.isDark ? "#bbb" : "#666"} />
        <YAxis stroke={theme.isDark ? "#bbb" : "#666"} />
        <Tooltip
          contentStyle={{
            backgroundColor: theme.isDark ? "#1f1f1f" : "#fff",
            borderColor: theme.isDark ? "#444" : "#ddd",
            color: theme.isDark ? "#fff" : "#111",
          }}
        />
        <Line type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  </Card>
);

export const plugin = new PanelPlugin(LLMWatchPanel);

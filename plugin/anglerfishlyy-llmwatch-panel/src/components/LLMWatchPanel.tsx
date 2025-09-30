import React, { useEffect, useState } from "react";
import { PanelProps } from "@grafana/data";
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

interface Props extends PanelProps {}

export const LLMWatchPanel: React.FC<Props> = ({ width, height }) => {
  const [metrics, setMetrics] = useState<Metrics[]>([]);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8080/metrics/all");
        const data = await res.json();
        setMetrics(data);
      } catch (err) {
        console.error("Error fetching metrics:", err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  if (!metrics.length) {
    return <div>Loading metrics...</div>;
  }

  const latest = metrics[metrics.length - 1];
  const formatted = metrics.map((m) => ({
    ...m,
    time: new Date(m.timestamp).toLocaleTimeString(),
  }));

  return (
    <div style={{ padding: 16, width, height, overflow: "auto" }}>
      <h2 style={{ fontWeight: "bold", marginBottom: 16 }}>LLM Metrics Dashboard</h2>

      {/* Latest snapshot */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 }}>
        <div style={{ padding: 12, background: "#f0f0f0", borderRadius: 8 }}>
          <p style={{ fontWeight: 600 }}>Latency</p>
          <p>{latest.latency.toFixed(2)} ms</p>
        </div>
        <div style={{ padding: 12, background: "#f0f0f0", borderRadius: 8 }}>
          <p style={{ fontWeight: 600 }}>Cost</p>
          <p>${latest.cost.toFixed(6)}</p>
        </div>
        <div style={{ padding: 12, background: "#f0f0f0", borderRadius: 8 }}>
          <p style={{ fontWeight: 600 }}>Tokens</p>
          <p>{latest.promptTokens} + {latest.completionTokens} = {latest.totalTokens}</p>
        </div>
        {latest.error && (
          <div style={{ padding: 12, background: "#ffe5e5", borderRadius: 8, color: "#a00" }}>
            <p style={{ fontWeight: 600 }}>Error</p>
            <p>{latest.error}</p>
          </div>
        )}
      </div>

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
        {/* Latency */}
        <div style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Latency Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={formatted}>
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="latency" stroke="#8884d8" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Cost */}
        <div style={{ background: "#fff", borderRadius: 8, padding: 12 }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Cost Trend</h3>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={formatted}>
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="cost" stroke="#82ca9d" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Tokens */}
        <div style={{ background: "#fff", borderRadius: 8, padding: 12, gridColumn: "span 2" }}>
          <h3 style={{ fontWeight: 600, marginBottom: 8 }}>Token Usage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={formatted}>
              <CartesianGrid stroke="#ccc" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="promptTokens" fill="#8884d8" />
              <Bar dataKey="completionTokens" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

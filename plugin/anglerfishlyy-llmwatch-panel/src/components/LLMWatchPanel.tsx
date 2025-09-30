import React, { useEffect, useState } from "react";
import { PanelProps, PanelPlugin } from "@grafana/data";
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

const LLMWatchPanel: React.FC<PanelProps> = () => {
  const [metrics, setMetrics] = useState<Metrics[]>([]);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [metricsRes, aggRes] = await Promise.all([
          fetch("http://localhost:8080/metrics/all"),
          fetch("http://localhost:8080/metrics/aggregates"),
        ]);

        const metricsData = await metricsRes.json();
        const aggregatesData = await aggRes.json();

        setMetrics(metricsData);
        setAggregates(aggregatesData);
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
    <div className="p-4">
      <h2 className="text-lg font-bold mb-2">LLM Metrics Dashboard</h2>

      {/* Latest snapshot */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-gray-100 rounded-xl p-3 shadow">
          <p className="font-semibold">Latency</p>
          <p>{latest.latency.toFixed(2)} ms</p>
        </div>
        <div className="bg-gray-100 rounded-xl p-3 shadow">
          <p className="font-semibold">Cost</p>
          <p>${latest.cost.toFixed(6)}</p>
        </div>
        <div className="bg-gray-100 rounded-xl p-3 shadow">
          <p className="font-semibold">Tokens</p>
          <p>
            {latest.promptTokens} + {latest.completionTokens} ={" "}
            {latest.totalTokens}
          </p>
        </div>
        {latest.error && (
          <div className="bg-red-100 rounded-xl p-3 shadow text-red-600">
            <p className="font-semibold">Error</p>
            <p>{latest.error}</p>
          </div>
        )}
      </div>

      {/* Aggregates */}
      {aggregates && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-yellow-100 rounded-xl p-3 shadow">
            <p className="font-semibold">Avg Latency (last 10)</p>
            <p>{aggregates.avgLatency.toFixed(2)} ms</p>
          </div>
          <div className="bg-yellow-100 rounded-xl p-3 shadow">
            <p className="font-semibold">Avg Cost (last 10)</p>
            <p>${aggregates.avgCost.toFixed(6)}</p>
          </div>
          <div className="bg-yellow-100 rounded-xl p-3 shadow">
            <p className="font-semibold">Error Rate</p>
            <p>{(aggregates.errorRate * 100).toFixed(2)}%</p>
          </div>
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        {/* Latency trend */}
        <div className="bg-white rounded-xl shadow p-2">
          <h3 className="text-md font-bold mb-2">Latency Trend</h3>
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

        {/* Cost trend */}
        <div className="bg-white rounded-xl shadow p-2">
          <h3 className="text-md font-bold mb-2">Cost Trend</h3>
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

        {/* Tokens breakdown */}
        <div className="bg-white rounded-xl shadow p-2 col-span-2">
          <h3 className="text-md font-bold mb-2">Token Usage</h3>
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

// Export plugin
export const plugin = new PanelPlugin(LLMWatchPanel);

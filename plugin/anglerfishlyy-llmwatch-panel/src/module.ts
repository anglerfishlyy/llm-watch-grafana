import React, { useEffect, useState } from "react";
import { PanelProps } from "@grafana/data";

interface Metrics {
  timestamp: number;
  provider: string;
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

interface Options {
  provider: "cerebras" | "llama";
}

export const LLMWatchPanel: React.FC<PanelProps<Options>> = ({ options }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [aggregates, setAggregates] = useState<Aggregates | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const [latestRes, aggRes] = await Promise.all([
          fetch("http://localhost:8080/metrics/latest"),
          fetch("http://localhost:8080/metrics/aggregates"),
        ]);
        const latest = await latestRes.json();
        const agg = await aggRes.json();
        setMetrics(latest);
        setAggregates(agg);
      } catch (err) {
        console.error(err);
      }
    }, 3000);

    return () => clearInterval(interval);
  }, [options.provider]);

  if (!metrics) return <div>Loading metrics...</div>;

  return (
    <div className="p-4">
      <h2 className="text-lg font-bold">LLM Metrics ({metrics.provider})</h2>
      <p>Latency: {metrics.latency.toFixed(2)} ms</p>
      <p>Prompt tokens: {metrics.promptTokens}</p>
      <p>Completion tokens: {metrics.completionTokens}</p>
      <p>Total tokens: {metrics.totalTokens}</p>
      <p>Cost: ${metrics.cost.toFixed(6)}</p>
      {metrics.error && <p className="text-red-500">Error: {metrics.error}</p>}

      {aggregates && (
        <div className="mt-4">
          <h3 className="font-semibold">Aggregates (last 10)</h3>
          <p>Avg latency: {aggregates.avgLatency.toFixed(2)} ms</p>
          <p>Avg cost: ${aggregates.avgCost.toFixed(6)}</p>
          <p>Error rate: {(aggregates.errorRate * 100).toFixed(1)}%</p>
        </div>
      )}
    </div>
  );
};

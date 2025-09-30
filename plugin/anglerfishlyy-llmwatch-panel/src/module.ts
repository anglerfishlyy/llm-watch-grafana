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

interface Options {
  provider: "cerebras" | "llama";
}

export const LLMWatchPanel: React.FC<PanelProps<Options>> = ({ options }) => {
  const [metrics, setMetrics] = useState<Metrics | null>(null);

  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const res = await fetch("http://localhost:8080/metrics/latest");
        const data = await res.json();
        setMetrics(data);
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
    </div>
  );
};

// Panel options editor
export const panelPluginOptions = {
  optionsBuilder: (builder: any) => {
    builder
      .addRadio({
        path: "provider",
        name: "Provider",
        settings: {
          options: [
            { value: "cerebras", label: "Cerebras" },
            { value: "llama", label: "Meta Llama" },
          ],
        },
        defaultValue: "cerebras",
      });
  },
};

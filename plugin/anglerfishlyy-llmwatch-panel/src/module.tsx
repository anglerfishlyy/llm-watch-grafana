/**
 * @fileoverview Grafana panel plugin registration and configuration
 * @module module
 */

import { PanelPlugin } from "@grafana/data";
import { LLMWatchPanel, LLMWatchOptions } from "./components/LLMWatchPanel";

/**
 * LLM Watch Panel Plugin
 * Provides real-time observability for LLM requests with metrics visualization
 */
export const plugin = new PanelPlugin(LLMWatchPanel)
	.setPanelOptions((builder) => {
		return builder
			.addBooleanSwitch({
				path: 'showSparklines',
				name: 'Show Sparklines',
				description: 'Display mini trend charts in metric cards',
				defaultValue: true,
			})
			.addNumberInput({
				path: 'latencyThresholdWarning',
				name: 'Latency Warning Threshold (ms)',
				description: 'Show warning color when latency exceeds this value',
				defaultValue: 100,
			})
			.addNumberInput({
				path: 'latencyThresholdCritical',
				name: 'Latency Critical Threshold (ms)',
				description: 'Show critical color and alert when latency exceeds this value',
				defaultValue: 200,
			})
			.addNumberInput({
				path: 'costThresholdWarning',
				name: 'Cost Warning Threshold ($)',
				description: 'Show warning color when cost exceeds this value',
				defaultValue: 0.0001,
				settings: { step: 0.00001 },
			})
			.addNumberInput({
				path: 'costThresholdCritical',
				name: 'Cost Critical Threshold ($)',
				description: 'Show critical color and alert when cost exceeds this value',
				defaultValue: 0.0002,
				settings: { step: 0.00001 },
			})
			.addBooleanSwitch({
				path: 'usePrometheus',
				name: 'Use Prometheus',
				description: 'Fetch metrics from Prometheus datasource instead of agent endpoint',
				defaultValue: false,
			})
			.addTextInput({
				path: 'promQuery',
				name: 'PromQL Query',
				description: 'Prometheus query expression (only used when Use Prometheus is enabled)',
				defaultValue: 'llm_request_duration_ms',
				settings: {
					rows: 3,
				},
				showIf: (config) => config.usePrometheus,
			});
	});

// Export plugin as default for Grafana
export default plugin;

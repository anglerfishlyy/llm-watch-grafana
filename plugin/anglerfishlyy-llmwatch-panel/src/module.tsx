import { PanelPlugin } from "@grafana/data";
import { LLMWatchPanel } from "./components/LLMWatchPanel";
export const plugin = new PanelPlugin(LLMWatchPanel)
	.setPanelOptions((builder) => {
		return builder
			.addBooleanSwitch({
				path: 'usePrometheus',
				name: 'Use Prometheus',
				description: 'Toggle to fetch metrics from Prometheus (via Grafana datasource) instead of the agent endpoint',
				defaultValue: false,
			})
			.addTextInput({
				path: 'promQuery',
				name: 'PromQL Query',
				description: 'Prometheus query to run when Use Prometheus is enabled. You can use PromQL expressions and functions. Use a newline to separate complex queries or comments.',
				defaultValue: 'rate(http_requests_total[5m])',
				settings: {
					rows: 4,
				},
			});
	});

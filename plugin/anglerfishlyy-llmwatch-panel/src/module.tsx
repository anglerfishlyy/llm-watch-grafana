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
				description: 'Prometheus query to run (when Use Prometheus is enabled)',
				defaultValue: 'rate(http_requests_total[5m])',
			});
	});

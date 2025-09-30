import { PanelPlugin } from "@grafana/data";
import { LLMWatchPanel } from "./components/LLMWatchPanel";

export const plugin = new PanelPlugin(LLMWatchPanel);

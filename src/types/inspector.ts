// Inspector types — shared across client and server

export type InspectorSource = "agents" | "sessions";

export const INSPECTOR_SOURCES: InspectorSource[] = ["agents", "sessions"];

export interface ToolCallInfo {
  name: string;
  arguments: string; // JSON string
  resultPreview: string; // First 500 chars of result
}

export interface InspectorMessage {
  index: number;
  role: "user" | "assistant" | "system" | "tool";
  content: string; // Truncated to 500 chars in list view
  fullContent?: string; // Full content for detail view
  toolCalls?: ToolCallInfo[];
  toolResult?: string;
  tokensIn: number;
  tokensOut: number;
  tokensCache: number;
  costUsd: number;
  timestamp: string; // ISO
  durationMs: number; // Time from this message to next
}

export interface InspectorMeta {
  source: InspectorSource;
  id: string;
  model: string;
  status: string;
  totalTokensIn: number;
  totalTokensOut: number;
  totalTokensCache: number;
  totalCostUsd: number;
  startedAt: string; // ISO
  endedAt: string | null; // ISO
  durationMs: number;
  project?: string;
  taskDesc?: string;
}

export interface ToolSummary {
  totalCalls: number;
  toolsUsed: string[];
  byTool: Record<string, number>;
}

export interface CostBreakdown {
  input: number;
  output: number;
  cache: number;
}

export interface InspectorData {
  meta: InspectorMeta;
  messages: InspectorMessage[];
  toolSummary: ToolSummary;
  costBreakdown: CostBreakdown;
  transcriptAvailable: boolean;
}

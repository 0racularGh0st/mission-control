export type AgentHealth = "healthy" | "busy" | "degraded";

export interface ActiveAgentDto {
  id: string;
  name: string;
  role: string;
  health: AgentHealth;
  model: string;
  queueDepth: number;
  medianLatencyMs: number;
}

export interface TaskQueueLaneDto {
  lane: "now" | "next" | "blocked" | "review";
  label: string;
  stateLabel: string;
  count: number;
  etaMinutes: number | null;
}

export type AlertSeverity = "warning" | "critical";

export interface RuntimeAlertDto {
  id: string;
  title: string;
  detail: string;
  severity: AlertSeverity;
  stuckTaskId?: string;
  staleForMinutes?: number;
}

export interface TokenCostSummaryDto {
  inputTokens: number;
  outputTokens: number;
  totalCostUsd: number;
  projectedDayEndUsd: number;
  inputDeltaPct: number;
  outputDeltaPct: number;
  costDeltaUsd: number;
  withinBudget: boolean;
}

export interface ModelRoutingEntryDto {
  model: string;
  sharePct: number;
  role: string;
}

export interface RuntimeLogEntryDto {
  id: string;
  message: string;
  createdAtIso: string;
}

export interface DashboardSnapshotDto {
  generatedAtIso: string;
  source: "mock" | "runtime-api" | "runtime-sse";
  activeAgents: ActiveAgentDto[];
  queueSnapshot: TaskQueueLaneDto[];
  alerts: RuntimeAlertDto[];
  tokenCostSummary: TokenCostSummaryDto;
  modelRouting: ModelRoutingEntryDto[];
  recentLogs: RuntimeLogEntryDto[];
}

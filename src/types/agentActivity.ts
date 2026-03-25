export interface AgentActivityEntry {
  id: string;
  sessionKey: string;
  agentType: "cody" | "sandra" | "jarvis" | "subagent";
  model: string;
  startedAt: string; // ISO
  completedAt: string; // ISO
  durationMs: number;
  tokensIn: number;
  tokensOut: number;
  taskDescription: string;
  status: "running" | "completed" | "failed";
  resultSummary: string;
}

import type { DashboardSnapshotDto } from "./types";

interface DashboardRuntimeAdapter {
  getSnapshot(): Promise<DashboardSnapshotDto>;
}

const now = new Date();

const mockSnapshot: DashboardSnapshotDto = {
  generatedAtIso: now.toISOString(),
  source: "mock",
  activeAgents: [
    { id: "agent-planner", name: "Planner", role: "Router", health: "healthy", model: "gpt-5.4", queueDepth: 4, medianLatencyMs: 1300 },
    { id: "agent-coder", name: "Coder", role: "Execution", health: "busy", model: "gpt-5.3-codex", queueDepth: 7, medianLatencyMs: 2800 },
    { id: "agent-research", name: "Research", role: "Search", health: "healthy", model: "gpt-4.1", queueDepth: 3, medianLatencyMs: 1900 },
    { id: "agent-ops", name: "Ops", role: "Infra", health: "degraded", model: "o3", queueDepth: 5, medianLatencyMs: 4700 },
  ],
  queueSnapshot: [
    { lane: "now", label: "Now", stateLabel: "In progress", count: 6, etaMinutes: 14 },
    { lane: "next", label: "Next", stateLabel: "Queued", count: 8, etaMinutes: 31 },
    { lane: "blocked", label: "Blocked", stateLabel: "Needs input", count: 3, etaMinutes: null },
    { lane: "review", label: "Review", stateLabel: "Pending approval", count: 2, etaMinutes: 9 },
  ],
  alerts: [
    {
      id: "alert-task-571",
      title: "Stuck task T-571",
      detail: "No heartbeat for 11m on ops lane",
      severity: "critical",
      stuckTaskId: "T-571",
      staleForMinutes: 11,
    },
    { id: "alert-fallback-spike", title: "Model fallback spike", detail: "o3 fallback +12% in last 30m", severity: "warning" },
    { id: "alert-budget-watch", title: "Budget watch", detail: "Projected daily spend crossed soft cap", severity: "warning" },
  ],
  tokenCostSummary: {
    inputTokens: 164_000,
    outputTokens: 77_000,
    totalCostUsd: 4.82,
    projectedDayEndUsd: 8.1,
    inputDeltaPct: 8.2,
    outputDeltaPct: 3.7,
    costDeltaUsd: 0.71,
    withinBudget: true,
  },
  modelRouting: [
    { model: "gpt-5.4", sharePct: 42, role: "Planner / synthesis" },
    { model: "gpt-5.3-codex", sharePct: 31, role: "Coding tickets" },
    { model: "o3", sharePct: 17, role: "Reasoning / fallback" },
    { model: "gpt-4.1", sharePct: 10, role: "Fast support" },
  ],
  recentLogs: [
    { id: "log-1", message: "16:42 Scheduler: Task T-584 promoted to NOW lane.", createdAtIso: now.toISOString() },
    { id: "log-2", message: "16:39 Coder: Ticket 4 merged on main (lint/build clean).", createdAtIso: now.toISOString() },
    { id: "log-3", message: "16:33 Router: switched low-risk requests to gpt-4.1.", createdAtIso: now.toISOString() },
    { id: "log-4", message: "16:28 Ops: retrying stale worker session mc-node-03.", createdAtIso: now.toISOString() },
    { id: "log-5", message: "16:20 Planner: created handoff note for Ticket 5.", createdAtIso: now.toISOString() },
  ],
};

class MockDashboardAdapter implements DashboardRuntimeAdapter {
  async getSnapshot(): Promise<DashboardSnapshotDto> {
    return {
      ...mockSnapshot,
      generatedAtIso: new Date().toISOString(),
    };
  }
}

/**
 * Runtime API/SSE adapter placeholder.
 * Swap in real fetch/SSE hydration when runtime transport is ready.
 */
class RuntimeDashboardAdapter implements DashboardRuntimeAdapter {
  async getSnapshot(): Promise<DashboardSnapshotDto> {
    return {
      ...(await new MockDashboardAdapter().getSnapshot()),
      source: "runtime-api",
    };
  }
}

function shouldUseRuntimeAdapter() {
  return process.env.MISSION_CONTROL_RUNTIME_SOURCE === "runtime";
}

export function getDashboardAdapter(): DashboardRuntimeAdapter {
  if (shouldUseRuntimeAdapter()) {
    return new RuntimeDashboardAdapter();
  }
  return new MockDashboardAdapter();
}

export async function getDashboardSnapshot() {
  return getDashboardAdapter().getSnapshot();
}

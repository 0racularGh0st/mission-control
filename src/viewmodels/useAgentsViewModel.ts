import { useMemo } from "react";

import type { DashboardSnapshotDto } from "@/src/runtime/dashboard/types";

export interface AgentListItemViewModel {
  id: string;
  name: string;
  role: string;
  health: string;
  model: string;
  queueDepthLabel: string;
  latencyLabel: string;
}

function formatLatency(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function useAgentsViewModel(snapshot: DashboardSnapshotDto) {
  return useMemo<AgentListItemViewModel[]>(
    () =>
      snapshot.activeAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        role: agent.role,
        health: titleCase(agent.health),
        model: agent.model,
        queueDepthLabel: `Q ${agent.queueDepth}`,
        latencyLabel: formatLatency(agent.medianLatencyMs),
      })),
    [snapshot.activeAgents],
  );
}

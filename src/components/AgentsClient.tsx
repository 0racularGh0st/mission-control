"use client";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useAgentsViewModel } from "@/src/viewmodels/useAgentsViewModel";

const CURSOR_STORAGE_KEY = "mission-control.agents.cursor";

export function AgentsClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });
  const agents = useAgentsViewModel(snapshot);

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Agents"
        description={`Live agent surface. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
      />
      <Panel title="Active agents" description="Shared dashboard runtime feed.">
        <div className="space-y-2 text-sm">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
              <span className="font-medium text-foreground">{agent.name}</span> · {agent.role} · {agent.health} · {agent.queueDepthLabel} · {agent.latencyLabel}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

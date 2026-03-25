"use client";

import { useEffect, useState } from "react";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { useAgentsViewModel } from "@/src/viewmodels/useAgentsViewModel";

const CURSOR_STORAGE_KEY = "mission-control.agents.cursor";

interface AgentInfo {
  id: string;
  name: string;
  workspace: string;
  model: string;
  health: "healthy" | "busy" | "unknown";
}

export function AgentsClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });
  const agents = useAgentsViewModel(snapshot);
  const [namedAgents, setNamedAgents] = useState<AgentInfo[]>([]);

  useEffect(() => {
    async function fetchNamedAgents() {
      try {
        const res = await fetch("/api/agents", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          setNamedAgents(data.agents ?? []);
        }
      } catch {
        // silently keep empty
      }
    }
    fetchNamedAgents();
  }, []);

  const AGENT_COLORS: Record<string, string> = {
    main: "text-purple-400",
    jarvis: "text-purple-400",
    cody: "text-green-400",
  };

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Agents"
        description={`Live agent surface. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
      />

      {namedAgents.length > 0 && (
        <Panel title="Known agents" description="Registered agents from openclaw.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {namedAgents.map((agent) => (
              <div
                key={agent.id}
                className="rounded-md border border-border/60 bg-background/35 px-4 py-3 text-sm"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className={`font-semibold ${AGENT_COLORS[agent.id] ?? "text-foreground"}`}>
                      {agent.name}
                    </span>
                    <span className="ml-2 text-xs text-muted-foreground">({agent.id})</span>
                  </div>
                  <span
                    className={`inline-flex rounded border px-2 py-0.5 text-xs font-medium ${
                      agent.health === "healthy"
                        ? "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                        : agent.health === "busy"
                          ? "border-blue-500/30 bg-blue-500/20 text-blue-400"
                          : "border-muted bg-muted text-muted-foreground"
                    }`}
                  >
                    {agent.health}
                  </span>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {agent.model} · {agent.workspace.replace(/^~/, "$HOME")}
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

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

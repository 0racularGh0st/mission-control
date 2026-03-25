"use client";

import { useOfficeViewModel } from "@/src/viewmodels/useOfficeViewModel";
import { OfficeCanvas } from "./OfficeCanvas";
import type { AgentState } from "@/src/viewmodels/useOfficeViewModel";

const STATE_LABELS: Record<AgentState, { label: string; color: string }> = {
  idle: { label: "Idle", color: "text-gray-400" },
  busy: { label: "Busy", color: "text-sky-400" },
  thinking: { label: "Thinking", color: "text-amber-300" },
};

export function OfficeClient() {
  const { state } = useOfficeViewModel();

  return (
    <div className="flex flex-col gap-3">
      {/* Status bar */}
      <div className="flex items-center gap-4 rounded-lg border border-border/60 bg-card/60 px-4 py-2 text-xs">
        <span className="font-medium text-muted-foreground uppercase tracking-wider">Office Status</span>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-purple-400">JARVIS</span>
          <span className={STATE_LABELS[state.jarvis.state].color}>
            {STATE_LABELS[state.jarvis.state].label}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-medium text-emerald-400">CODY</span>
          <span className={STATE_LABELS[state.cody.state].color}>
            {STATE_LABELS[state.cody.state].label}
          </span>
        </div>
        <span className="ml-auto text-muted-foreground">
          Last updated: <span suppressHydrationWarning>{new Date(state.lastUpdated).toLocaleTimeString("en-US", { hour12: false })}</span>
        </span>
      </div>

      {/* Canvas */}
      <OfficeCanvas jarvis={state.jarvis} cody={state.cody} />
    </div>
  );
}

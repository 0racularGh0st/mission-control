"use client";

import { useOfficeViewModel } from "@/src/viewmodels/useOfficeViewModel";
import { OfficeCanvas } from "./OfficeCanvas";
import { RefreshCw } from "lucide-react";
import type { AgentState } from "@/src/viewmodels/useOfficeViewModel";

const AGENTS: {
  key: "jarvis" | "cody" | "claudius";
  name: string;
  accent: string;
  dot: string;
}[] = [
  { key: "jarvis", name: "Jarvis", accent: "text-purple-400", dot: "bg-purple-400" },
  { key: "cody", name: "Cody", accent: "text-emerald-400", dot: "bg-emerald-400" },
  { key: "claudius", name: "Claudius", accent: "text-orange-400", dot: "bg-orange-400" },
];

const STATE_META: Record<AgentState, { label: string; color: string }> = {
  idle: { label: "Idle", color: "text-gray-500" },
  busy: { label: "Working", color: "text-sky-400" },
  thinking: { label: "Thinking", color: "text-amber-300" },
};

export function OfficeClient() {
  const { state, refresh, isRefreshing } = useOfficeViewModel();

  return (
    <div className="flex flex-col gap-2">
      {/* Status bar */}
      <div className="flex items-center gap-5 rounded-lg border border-border/40 bg-card/40 px-4 py-2.5 text-xs backdrop-blur-sm">
        {AGENTS.map(({ key, name, accent, dot }) => {
          const agent = state[key];
          const meta = STATE_META[agent.state];
          return (
            <div key={key} className="flex items-center gap-2">
              <span
                className={`h-1.5 w-1.5 rounded-full ${dot} ${
                  agent.state === "busy"
                    ? "animate-pulse"
                    : agent.state === "thinking"
                      ? "animate-pulse"
                      : "opacity-40"
                }`}
              />
              <span className={`font-semibold tracking-wide ${accent}`}>
                {name}
              </span>
              <span className={meta.color}>{meta.label}</span>
              {agent.detail && (
                <span className="text-muted-foreground/60 max-w-[160px] truncate">
                  {agent.detail}
                </span>
              )}
            </div>
          );
        })}
        <div className="ml-auto flex items-center gap-2 text-muted-foreground/60">
          <span className="tabular-nums" suppressHydrationWarning>
            {new Date(state.lastUpdated).toLocaleTimeString("en-US", {
              hour12: false,
            })}
          </span>
          <button
            onClick={refresh}
            disabled={isRefreshing}
            aria-label="Refresh presence"
            title="Refresh presence"
            className="rounded p-1 text-muted-foreground/50 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          >
            <RefreshCw
              className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <OfficeCanvas
        jarvis={state.jarvis}
        cody={state.cody}
        claudius={state.claudius}
      />
    </div>
  );
}

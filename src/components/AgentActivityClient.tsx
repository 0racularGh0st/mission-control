"use client";

import { useEffect, useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

const STATUS_COLORS: Record<AgentActivityEntry["status"], string> = {
  completed: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/20 text-red-400 border-red-500/30",
  running: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const AGENT_COLORS: Record<AgentActivityEntry["agentType"], string> = {
  jarvis: "text-purple-400",
  cody: "text-green-400",
  sandra: "text-amber-400",
  subagent: "text-cyan-400",
};

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60_000).toFixed(1)}m`;
}

function formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

export function AgentActivityClient() {
  const [activities, setActivities] = useState<AgentActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchActivities() {
    try {
      const res = await fetch("/api/agents/activity", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setActivities(data.activities ?? []);
      }
    } catch {
      // keep previous state on error
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchActivities();
    const interval = setInterval(fetchActivities, 10_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Agent Activity</span>
          {!loading && (
            <span className="text-xs font-normal text-muted-foreground">
              {activities.length} entries
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading && activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Loading...
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No agent activity yet. Activity will appear here as agents run.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Agent</th>
                  <th className="pb-2 pr-4 font-medium">Model</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">In</th>
                  <th className="pb-2 pr-4 font-medium">Out</th>
                  <th className="pb-2 pr-4 font-medium">Est. Cost</th>
                  <th className="pb-2 pr-4 font-medium">Status</th>
                  <th className="pb-2 font-medium">Task</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {activities.map((entry) => (
                  <tr
                    key={entry.id}
                    className="text-muted-foreground hover:bg-background/40 transition-colors"
                  >
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                      {formatTime(entry.startedAt)}
                    </td>
                    <td className={`py-2 pr-4 font-medium ${AGENT_COLORS[entry.agentType] ?? "text-foreground"}`}>
                      {entry.agentType}
                    </td>
                    <td className="py-2 pr-4 text-xs whitespace-nowrap">
                      {entry.model}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                      {formatDuration(entry.durationMs)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {formatTokens(entry.tokensIn)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {formatTokens(entry.tokensOut)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {entry.estimatedCostUsd > 0 ? `$${entry.estimatedCostUsd.toFixed(4)}` : "—"}
                    </td>
                    <td className="py-2 pr-4">
                      <span
                        className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status] ?? "bg-muted text-muted-foreground"}`}
                      >
                        {entry.status}
                      </span>
                    </td>
                    <td className="py-2 max-w-[240px] truncate text-xs" title={entry.taskDescription}>
                      {entry.taskDescription}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

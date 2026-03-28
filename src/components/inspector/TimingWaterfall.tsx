"use client";

import { cn } from "@/lib/utils";
import type { InspectorMessage } from "@/src/types/inspector";

interface TimingWaterfallProps {
  messages: InspectorMessage[];
}

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

const ROLE_COLOR: Record<string, string> = {
  system: "bg-violet-400/60",
  user: "bg-blue-400/60",
  assistant: "bg-emerald-400/60",
  tool: "bg-amber-400/60",
};

export function TimingWaterfall({ messages }: TimingWaterfallProps) {
  const timedMessages = messages.filter((m) => m.durationMs > 0);

  if (timedMessages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-3 text-center text-[11px] text-muted-foreground">
        No timing data available
      </div>
    );
  }

  const maxDuration = Math.max(...timedMessages.map((m) => m.durationMs));

  return (
    <div className="space-y-0.5">
      {timedMessages.map((msg) => {
        const pct = maxDuration > 0 ? (msg.durationMs / maxDuration) * 100 : 0;
        const barColor = ROLE_COLOR[msg.role] ?? ROLE_COLOR.assistant;

        return (
          <div key={msg.index} className="flex items-center gap-2 text-[10px]">
            <span className="w-6 shrink-0 text-right text-muted-foreground">
              #{msg.index}
            </span>
            <span className="w-12 shrink-0 text-muted-foreground capitalize">
              {msg.role}
            </span>
            <div className="flex-1">
              <div
                className={cn("h-3 rounded-sm transition-all", barColor)}
                style={{ width: `${Math.max(pct, 2)}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right font-mono text-muted-foreground">
              {formatDuration(msg.durationMs)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

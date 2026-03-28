"use client";

import Link from "next/link";
import { ArrowRight, Brain } from "lucide-react";
import { Panel } from "@/src/components/primitives";
import type { MemoryStats } from "@/src/types/memory";

interface MemoryWidgetProps {
  stats: MemoryStats;
}

export function MemoryWidget({ stats }: MemoryWidgetProps) {
  return (
    <Panel
      title="Agent Memory"
      description="Indexed memory entries across all agents."
    >
      {stats.total > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Total memories</span>
            <span className="font-medium text-foreground">{stats.total}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["user", "feedback", "project", "reference"] as const).map((t) => (
              <div
                key={t}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background/35 px-2.5 py-1.5 text-[11px]"
              >
                <span className={
                  t === "user" ? "text-sky-400" :
                  t === "feedback" ? "text-amber-400" :
                  t === "project" ? "text-emerald-400" :
                  "text-violet-400"
                }>
                  {t}
                </span>
                <span className="text-muted-foreground">{stats.byType[t]}</span>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Edges</span>
            <span className="font-medium text-foreground">{stats.edgeCount}</span>
          </div>
          <Link
            href="/memory"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open memory graph
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center">
          <Brain className="mx-auto mb-1 h-5 w-5 text-sky-400/50" />
          <p className="text-xs text-muted-foreground">No memories indexed. Run a scan to discover agent context.</p>
        </div>
      )}
    </Panel>
  );
}

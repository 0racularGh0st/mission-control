"use client";

import Link from "next/link";
import { ArrowRight, ListTodo } from "lucide-react";
import { Panel } from "@/src/components/primitives";

export interface TaskLaneCounts {
  now: number;
  next: number;
  review: number;
  blocked: number;
  done: number;
}

interface TasksWidgetProps {
  laneCounts: TaskLaneCounts;
}

const LANE_META: { key: keyof TaskLaneCounts; label: string; color: string }[] = [
  { key: "now", label: "Now", color: "text-emerald-400" },
  { key: "next", label: "Next", color: "text-sky-400" },
  { key: "review", label: "Review", color: "text-amber-400" },
  { key: "blocked", label: "Blocked", color: "text-red-400" },
  { key: "done", label: "Done", color: "text-muted-foreground" },
];

export function TasksWidget({ laneCounts }: TasksWidgetProps) {
  const total = Object.values(laneCounts).reduce((a, b) => a + b, 0);

  return (
    <Panel title="Task Queue" description="Kanban lane pressure at a glance.">
      {total > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
            <span className="text-muted-foreground">Total tasks</span>
            <span className="font-medium text-foreground">{total}</span>
          </div>
          <div className="grid grid-cols-5 gap-1.5">
            {LANE_META.map(({ key, label, color }) => (
              <div
                key={key}
                className="flex flex-col items-center rounded-md border border-border/60 bg-background/35 px-2 py-2 text-center"
              >
                <span className={`text-base font-semibold ${color}`}>{laneCounts[key]}</span>
                <span className="text-[10px] text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <Link
            href="/tasks"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Open task board
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center">
          <ListTodo className="mx-auto mb-1 h-5 w-5 text-emerald-400/50" />
          <p className="text-xs text-muted-foreground">No tasks yet. Create tasks from the board.</p>
        </div>
      )}
    </Panel>
  );
}

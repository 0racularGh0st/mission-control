"use client";

import { cn } from "@/lib/utils";
import { type TimelineSource, TIMELINE_SOURCES } from "@/src/types/timeline";

const SOURCE_LABELS: Record<TimelineSource, string> = {
  tasks: "Tasks",
  agents: "Agents",
  sessions: "Sessions",
  costs: "Costs",
};

interface TimelineFilterBarProps {
  active: TimelineSource[];
  onChange: (sources: TimelineSource[]) => void;
}

export function TimelineFilterBar({ active, onChange }: TimelineFilterBarProps) {
  const allActive = active.length === 0;

  function toggle(source: TimelineSource) {
    if (active.includes(source)) {
      onChange(active.filter((s) => s !== source));
    } else {
      onChange([...active, source]);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        onClick={() => onChange([])}
        className={cn(
          "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
          allActive
            ? "bg-accent/35 text-foreground"
            : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
        )}
      >
        All
      </button>
      {TIMELINE_SOURCES.map((source) => (
        <button
          key={source}
          onClick={() => toggle(source)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            !allActive && active.includes(source)
              ? "bg-accent/35 text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {SOURCE_LABELS[source]}
        </button>
      ))}
    </div>
  );
}

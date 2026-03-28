"use client";

import { cn } from "@/lib/utils";
import type { RetrySource, RetryStatus } from "@/src/types/retries";

const STATUS_FILTERS: { label: string; value: RetryStatus | null }[] = [
  { label: "Failed", value: "failed" },
  { label: "Retrying", value: "retrying" },
  { label: "Resolved", value: "resolved" },
  { label: "Dismissed", value: "dismissed" },
  { label: "All", value: null },
];

const SOURCE_FILTERS: { label: string; value: RetrySource | null }[] = [
  { label: "All sources", value: null },
  { label: "Agents", value: "agents" },
  { label: "Tasks", value: "tasks" },
  { label: "Sessions", value: "sessions" },
];

interface RetryFilterBarProps {
  activeStatus: RetryStatus | null;
  activeSource: RetrySource | null;
  onStatusChange: (status: RetryStatus | null) => void;
  onSourceChange: (source: RetrySource | null) => void;
}

export function RetryFilterBar({
  activeStatus,
  activeSource,
  onStatusChange,
  onSourceChange,
}: RetryFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3" data-filter-bar>
      <div className="flex flex-wrap items-center gap-1.5">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => onStatusChange(f.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeStatus === f.value
                ? "bg-accent/35 text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
      <span className="text-border">|</span>
      <div className="flex flex-wrap items-center gap-1.5">
        {SOURCE_FILTERS.map((f) => (
          <button
            key={f.label}
            onClick={() => onSourceChange(f.value)}
            className={cn(
              "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
              activeSource === f.value
                ? "bg-accent/35 text-foreground"
                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>
    </div>
  );
}

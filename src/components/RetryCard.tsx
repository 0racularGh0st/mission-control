"use client";

import { cn } from "@/lib/utils";
import type { RetryEntry, RetrySource, RetryStatus } from "@/src/types/retries";

const STATUS_ICON: Record<RetryStatus, { icon: string; className: string }> = {
  failed: { icon: "\u2715", className: "text-red-400" },
  retrying: { icon: "\u27F3", className: "text-amber-300 animate-spin" },
  resolved: { icon: "\u2713", className: "text-emerald-400" },
  dismissed: { icon: "\u2014", className: "text-muted-foreground" },
};

const STATUS_BADGE: Record<RetryStatus, { label: string; className: string }> = {
  failed: { label: "FAILED", className: "bg-red-500/15 text-red-300 border-red-500/35" },
  retrying: { label: "RETRYING", className: "bg-amber-400/15 text-amber-200 border-amber-400/35" },
  resolved: { label: "RESOLVED", className: "bg-emerald-400/15 text-emerald-300 border-emerald-400/35" },
  dismissed: { label: "DISMISSED", className: "bg-muted/50 text-muted-foreground border-border" },
};

const SOURCE_BADGE: Record<RetrySource, string> = {
  agents: "bg-violet-400/10 text-violet-300 border-violet-400/30",
  tasks: "bg-blue-400/10 text-blue-300 border-blue-400/30",
  sessions: "bg-cyan-400/10 text-cyan-300 border-cyan-400/30",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

interface RetryCardProps {
  retry: RetryEntry;
  selected?: boolean;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
  onExpand?: (id: string) => void;
}

export function RetryCard({ retry, selected, onRetry, onDismiss, onExpand }: RetryCardProps) {
  const isFailed = retry.status === "failed";
  const isRetrying = retry.status === "retrying";
  const isTerminal = retry.status === "resolved" || retry.status === "dismissed";
  const statusIcon = STATUS_ICON[retry.status];
  const statusBadge = STATUS_BADGE[retry.status];
  const sourceBadge = SOURCE_BADGE[retry.source];

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 transition-colors",
        selected && "border-accent/50 bg-accent/10",
        isTerminal && "opacity-60",
      )}
      data-retry-id={retry.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Status icon + badges + timestamp */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("text-sm font-bold", statusIcon.className)}>
              {statusIcon.icon}
            </span>
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase", statusBadge.className)}>
              {statusBadge.label}
            </span>
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", sourceBadge)}>
              {retry.source}
            </span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(retry.createdAt)}</span>
          </div>

          {/* Error summary */}
          <p className="text-xs font-medium text-foreground line-clamp-2">{retry.errorSummary}</p>

          {/* Attempt info */}
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Attempt {retry.attemptCount}/{retry.maxAttempts}
            {retry.lastAttemptAt && ` \u00b7 last: ${timeAgo(retry.lastAttemptAt)}`}
          </p>
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-2 flex items-center gap-2">
        {isFailed && (
          <>
            <button
              onClick={() => onRetry?.(retry.id)}
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
            >
              Retry (R)
            </button>
            <button
              onClick={() => onDismiss?.(retry.id)}
              className="rounded-md border border-muted/60 bg-muted/20 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
            >
              Dismiss (d)
            </button>
          </>
        )}
        {isRetrying && (
          <span className="text-[11px] text-amber-200">Retrying...</span>
        )}
        <button
          onClick={() => onExpand?.(retry.id)}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          Details
        </button>
      </div>
    </div>
  );
}

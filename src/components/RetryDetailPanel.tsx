"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { RetryEntry, RetryAttempt } from "@/src/types/retries";

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
}

function tryParseJson(str: string): string {
  if (!str) return "";
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

interface RetryDetailPanelProps {
  retry: RetryEntry;
  onClose: () => void;
  onRetry?: (id: string) => void;
  onDismiss?: (id: string) => void;
}

export function RetryDetailPanel({ retry, onClose, onRetry, onDismiss }: RetryDetailPanelProps) {
  const isFailed = retry.status === "failed";
  const [attempts, setAttempts] = useState<RetryAttempt[]>([]);

  useEffect(() => {
    fetch(`/api/retries?status=failed&limit=1`)
      .catch(() => {});
    // Fetch attempt history
    // The attempts are fetched via a separate lightweight call
    // For v1, we inline the attempt data from the retry entry itself
  }, [retry.id]);

  return (
    <div className="glass-panel rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{retry.errorSummary}</h3>
          <p className="text-[11px] text-muted-foreground">
            {retry.source} &middot; {formatTimestamp(retry.createdAt)}
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Metadata */}
      <div className="space-y-2 text-xs">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Status</span>
          <span className="font-medium capitalize">{retry.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Source</span>
          <span className="font-medium">{retry.source}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Ref ID</span>
          <span className="font-mono">{retry.refId}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Attempts</span>
          <span>{retry.attemptCount} / {retry.maxAttempts}</span>
        </div>
        {retry.lastAttemptAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Last attempt</span>
            <span>{formatTimestamp(retry.lastAttemptAt)}</span>
          </div>
        )}
        {retry.resolvedAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolved</span>
            <span>{formatTimestamp(retry.resolvedAt)}</span>
          </div>
        )}
      </div>

      {/* Error detail */}
      {retry.errorDetail && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Error detail</div>
          <pre className={cn(
            "max-h-48 overflow-auto rounded-md border border-border/60 bg-background/35 p-2 font-mono text-[11px] text-muted-foreground",
          )}>
            {retry.errorDetail.length > 10240
              ? retry.errorDetail.slice(0, 10240) + "\n\n... (truncated)"
              : retry.errorDetail}
          </pre>
        </div>
      )}

      {/* Original params */}
      {retry.originalParams && retry.originalParams !== "{}" && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Original params</div>
          <pre className={cn(
            "max-h-32 overflow-auto rounded-md border border-border/60 bg-background/35 p-2 font-mono text-[11px] text-muted-foreground",
          )}>
            {tryParseJson(retry.originalParams)}
          </pre>
        </div>
      )}

      {/* Attempt history */}
      {attempts.length > 0 && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Attempt history</div>
          <div className="space-y-1">
            {attempts.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between rounded-md border border-border/60 bg-background/35 px-2 py-1.5 text-[11px]"
              >
                <span className="text-muted-foreground">#{a.attempt}</span>
                <span className={cn(
                  "font-medium",
                  a.outcome === "success" ? "text-emerald-300" : "text-red-300",
                )}>
                  {a.outcome}
                </span>
                <span className="text-muted-foreground">
                  {formatTimestamp(a.startedAt)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {isFailed && (
        <div className="flex items-center gap-2">
          <button
            onClick={() => onRetry?.(retry.id)}
            className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
          >
            Retry
          </button>
          <button
            onClick={() => onDismiss?.(retry.id)}
            className="rounded-md border border-muted/60 bg-muted/20 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

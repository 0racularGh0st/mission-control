"use client";

import Link from "next/link";
import { ArrowUpRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectorData, InspectorSource } from "@/src/types/inspector";
import { MessageList } from "@/src/components/inspector/MessageList";
import { TokenBreakdown } from "@/src/components/inspector/TokenBreakdown";

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

interface InspectorPanelProps {
  data: InspectorData | null;
  loading: boolean;
  error: string | null;
  selectedMessageIndex: number | null;
  onSelectMessage: (index: number) => void;
  onClose: () => void;
}

export function InspectorPanel({
  data,
  loading,
  error,
  selectedMessageIndex,
  onSelectMessage,
  onClose,
}: InspectorPanelProps) {
  // Loading state
  if (loading) {
    return (
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Inspector</span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-6 animate-pulse rounded-md bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-3 p-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">Inspector</span>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-2 text-[11px] text-red-300">
          {error}
        </div>
      </div>
    );
  }

  // No data state
  if (!data) {
    return (
      <div className="space-y-2 text-sm text-muted-foreground">
        <p>No item selected.</p>
        <p>Click a session or agent row, or press <kbd className="rounded border border-border/60 bg-background/50 px-1 py-0.5 font-mono text-[10px]">i</kbd> to toggle.</p>
      </div>
    );
  }

  const { meta, messages, toolSummary } = data;

  return (
    <div className="space-y-3 p-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-foreground">
              {meta.source === "sessions" ? "Session" : "Agent"} {meta.id.slice(0, 12)}
            </span>
            <span className={cn(
              "rounded-md border px-1 py-0.5 text-[9px] font-semibold uppercase",
              meta.status === "completed"
                ? "border-emerald-400/30 bg-emerald-400/10 text-emerald-300"
                : meta.status === "failed"
                  ? "border-red-500/30 bg-red-500/10 text-red-300"
                  : "border-amber-400/30 bg-amber-400/10 text-amber-200",
            )}>
              {meta.status}
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {meta.model} &middot; {formatDuration(meta.durationMs)} &middot; ${meta.totalCostUsd.toFixed(3)}
          </p>
          {meta.project && (
            <p className="text-[11px] text-muted-foreground">{meta.project}</p>
          )}
          {meta.taskDesc && (
            <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{meta.taskDesc}</p>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
          title="Close (Esc)"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Tokens */}
      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tokens</div>
        <TokenBreakdown
          tokensIn={meta.totalTokensIn}
          tokensOut={meta.totalTokensOut}
          tokensCache={meta.totalTokensCache}
          compact
        />
      </div>

      {/* Tools used */}
      {toolSummary.totalCalls > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Tools ({toolSummary.totalCalls})
          </div>
          <div className="flex flex-wrap gap-1">
            {Object.entries(toolSummary.byTool).map(([name, count]) => (
              <span
                key={name}
                className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] text-amber-200"
              >
                {name}({count})
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          Messages ({messages.length})
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          <MessageList
            messages={messages.slice(0, 50)}
            selectedIndex={selectedMessageIndex}
            onSelect={onSelectMessage}
            compact
          />
          {messages.length > 50 && (
            <p className="mt-1 text-center text-[10px] text-muted-foreground">
              Showing 50 of {messages.length} — open full view for all
            </p>
          )}
        </div>
      </div>

      {/* Full view link */}
      <Link
        href={`/inspect/${meta.source}/${meta.id}`}
        className="flex items-center gap-1 text-[11px] text-muted-foreground transition-colors hover:text-foreground"
      >
        Open Full View
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  );
}

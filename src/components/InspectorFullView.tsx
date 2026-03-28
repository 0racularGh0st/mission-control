"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

import { SectionHeader } from "@/src/components/primitives";
import { MessageList } from "@/src/components/inspector/MessageList";
import { MessageDetail } from "@/src/components/inspector/MessageDetail";
import { TokenBreakdown } from "@/src/components/inspector/TokenBreakdown";
import { TimingWaterfall } from "@/src/components/inspector/TimingWaterfall";
import { CostAttribution } from "@/src/components/inspector/CostAttribution";
import type { InspectorData, InspectorSource } from "@/src/types/inspector";

function formatDuration(ms: number): string {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)}m`;
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
}

const MESSAGE_PAGE_SIZE = 50;

export function InspectorFullView() {
  const params = useParams();
  const source = params.source as InspectorSource;
  const id = params.id as string;

  const [data, setData] = useState<InspectorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedMessageIndex, setSelectedMessageIndex] = useState<number | null>(null);
  const [messagePage, setMessagePage] = useState(1);

  useEffect(() => {
    if (!source || !id) return;

    setLoading(true);
    setError(null);

    fetch(`/api/inspect/${source}/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message ?? "Failed to load");
        setLoading(false);
      });
  }, [source, id]);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (!data) return;

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const max = Math.min(data.messages.length - 1, messagePage * MESSAGE_PAGE_SIZE - 1);
        const offset = (messagePage - 1) * MESSAGE_PAGE_SIZE;
        setSelectedMessageIndex((prev) => {
          if (prev === null) return offset;
          return Math.min(prev + 1, max);
        });
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const offset = (messagePage - 1) * MESSAGE_PAGE_SIZE;
        setSelectedMessageIndex((prev) => {
          if (prev === null) return offset;
          return Math.max(prev - 1, offset);
        });
        return;
      }

      if (e.key === "Escape") {
        setSelectedMessageIndex(null);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [data, messagePage]);

  if (loading) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Inspector" description="Loading..." />
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted/30" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <SectionHeader title="Inspector" description="Error loading inspection data." />
        <div className="rounded-md border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
          {error ?? "No data found for this item."}
        </div>
        <Link
          href="/"
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Back to Dashboard
        </Link>
      </div>
    );
  }

  const { meta, messages, toolSummary, costBreakdown } = data;
  const totalPages = Math.ceil(messages.length / MESSAGE_PAGE_SIZE);
  const pageMessages = messages.slice(
    (messagePage - 1) * MESSAGE_PAGE_SIZE,
    messagePage * MESSAGE_PAGE_SIZE,
  );

  const selectedMessage = selectedMessageIndex !== null
    ? messages.find((m) => m.index === selectedMessageIndex) ?? null
    : null;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link
          href={meta.source === "sessions" ? "/claude" : "/agents"}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <SectionHeader
          title={`${meta.source === "sessions" ? "Session" : "Agent"}: ${meta.id}`}
          description={`${meta.model} · ${formatDuration(meta.durationMs)} · $${meta.totalCostUsd.toFixed(4)} · ${meta.status}`}
        />
      </div>

      {/* Meta cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Status</div>
          <div className={cn(
            "text-sm font-medium capitalize",
            meta.status === "completed" ? "text-emerald-300" :
            meta.status === "failed" ? "text-red-300" : "text-amber-200",
          )}>
            {meta.status}
          </div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Duration</div>
          <div className="text-sm font-medium text-foreground">{formatDuration(meta.durationMs)}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Cost</div>
          <div className="text-sm font-medium text-foreground">${meta.totalCostUsd.toFixed(4)}</div>
        </div>
        <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
          <div className="text-[10px] uppercase text-muted-foreground">Messages</div>
          <div className="text-sm font-medium text-foreground">{messages.length}</div>
        </div>
      </div>

      {/* Timestamps */}
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-muted-foreground">
        <span>Started: {formatTimestamp(meta.startedAt)}</span>
        {meta.endedAt && <span>Ended: {formatTimestamp(meta.endedAt)}</span>}
        {meta.project && <span>Project: {meta.project}</span>}
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Left: Messages + Detail */}
        <div className="space-y-4">
          {/* Token breakdown */}
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Token Breakdown</div>
            <TokenBreakdown
              tokensIn={meta.totalTokensIn}
              tokensOut={meta.totalTokensOut}
              tokensCache={meta.totalTokensCache}
            />
          </div>

          {/* Tool summary */}
          {toolSummary.totalCalls > 0 && (
            <div className="rounded-lg border border-border/60 bg-background/35 p-3">
              <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Tools Used ({toolSummary.totalCalls} calls)
              </div>
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(toolSummary.byTool).map(([name, count]) => (
                  <span
                    key={name}
                    className="inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200"
                  >
                    {name} ({count})
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Message list */}
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Messages ({messages.length})
              {totalPages > 1 && ` — Page ${messagePage}/${totalPages}`}
            </div>
            <MessageList
              messages={pageMessages}
              selectedIndex={selectedMessageIndex}
              onSelect={setSelectedMessageIndex}
            />
            {totalPages > 1 && (
              <div className="mt-2 flex items-center justify-between border-t border-border/40 pt-2">
                <button
                  onClick={() => setMessagePage((p) => Math.max(1, p - 1))}
                  disabled={messagePage <= 1}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  Prev
                </button>
                <span className="text-[11px] text-muted-foreground">
                  {messagePage}/{totalPages}
                </span>
                <button
                  onClick={() => setMessagePage((p) => Math.min(totalPages, p + 1))}
                  disabled={messagePage >= totalPages}
                  className="rounded-md px-2 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Selected message detail */}
          {selectedMessage && (
            <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
              <MessageDetail
                message={selectedMessage}
                source={source}
                inspectId={id}
                onClose={() => setSelectedMessageIndex(null)}
              />
            </div>
          )}
        </div>

        {/* Right sidebar: Timing + Cost */}
        <div className="space-y-4">
          {/* Timing waterfall */}
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Timing Waterfall</div>
            <TimingWaterfall messages={messages} />
          </div>

          {/* Cost attribution */}
          <div className="rounded-lg border border-border/60 bg-background/35 p-3">
            <div className="mb-2 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Cost Attribution</div>
            <CostAttribution
              messages={messages}
              costBreakdown={costBreakdown}
              totalCostUsd={meta.totalCostUsd}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

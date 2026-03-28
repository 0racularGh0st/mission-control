"use client";

import type { CostBreakdown, InspectorMessage } from "@/src/types/inspector";

interface CostAttributionProps {
  messages: InspectorMessage[];
  costBreakdown: CostBreakdown;
  totalCostUsd: number;
}

export function CostAttribution({ messages, costBreakdown, totalCostUsd }: CostAttributionProps) {
  const costedMessages = messages.filter((m) => m.costUsd > 0);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center justify-between rounded-md border border-border/60 bg-background/35 px-3 py-2 text-xs">
        <span className="text-muted-foreground">Total cost</span>
        <span className="font-medium text-foreground">${totalCostUsd.toFixed(4)}</span>
      </div>

      {/* Breakdown by type */}
      <div className="space-y-1 text-[11px]">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-blue-400/70" />
            <span className="text-muted-foreground">Input</span>
          </span>
          <span className="text-muted-foreground">${costBreakdown.input.toFixed(4)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/70" />
            <span className="text-muted-foreground">Output</span>
          </span>
          <span className="text-muted-foreground">${costBreakdown.output.toFixed(4)}</span>
        </div>
        {costBreakdown.cache > 0 && (
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-400/50" />
              <span className="text-muted-foreground">Cache</span>
            </span>
            <span className="text-muted-foreground">${costBreakdown.cache.toFixed(4)}</span>
          </div>
        )}
      </div>

      {/* Per-message cost with running total */}
      {costedMessages.length > 0 && (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
            Per-message cost
          </div>
          <div className="space-y-0.5">
            {(() => {
              let runningTotal = 0;
              return costedMessages.map((msg) => {
                runningTotal += msg.costUsd;
                return (
                  <div
                    key={msg.index}
                    className="flex items-center justify-between rounded border border-border/40 bg-background/25 px-2 py-1 text-[10px]"
                  >
                    <span className="text-muted-foreground">
                      #{msg.index} {msg.role}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="text-muted-foreground">${msg.costUsd.toFixed(4)}</span>
                      <span className="font-mono text-foreground/70">Σ ${runningTotal.toFixed(4)}</span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
          <p className="mt-1 text-[10px] italic text-muted-foreground/60">
            Estimated — may differ from session total
          </p>
        </div>
      )}
    </div>
  );
}

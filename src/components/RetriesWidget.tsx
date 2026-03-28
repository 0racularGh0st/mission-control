"use client";

import Link from "next/link";
import { ArrowRight, RotateCcw } from "lucide-react";
import { Panel } from "@/src/components/primitives";
import type { RetryEntry } from "@/src/types/retries";

interface RetriesWidgetProps {
  failedCount: number;
  mostRecent: RetryEntry | null;
}

export function RetriesWidget({ failedCount, mostRecent }: RetriesWidgetProps) {
  return (
    <Panel
      title="Retries"
      description="Failed operations awaiting retry or dismissal."
    >
      {failedCount > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
            <span className="text-xs font-medium text-red-300">
              {failedCount} failed retr{failedCount !== 1 ? "ies" : "y"}
            </span>
          </div>
          {mostRecent && (
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{mostRecent.source}</span>
                <span className="text-[10px] text-muted-foreground">
                  {mostRecent.attemptCount}/{mostRecent.maxAttempts}
                </span>
              </div>
              <p className="mt-0.5 text-muted-foreground line-clamp-1">{mostRecent.errorSummary}</p>
            </div>
          )}
          <Link
            href="/retries"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Review failures
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center">
          <RotateCcw className="mx-auto mb-1 h-5 w-5 text-emerald-400/50" />
          <p className="text-xs text-muted-foreground">All systems nominal. No failures to retry.</p>
        </div>
      )}
    </Panel>
  );
}

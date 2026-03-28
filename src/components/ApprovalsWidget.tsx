"use client";

import Link from "next/link";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Panel } from "@/src/components/primitives";
import type { Approval } from "@/src/types/approvals";

interface ApprovalsWidgetProps {
  pendingCount: number;
  oldest: Approval | null;
}

export function ApprovalsWidget({ pendingCount, oldest }: ApprovalsWidgetProps) {
  return (
    <Panel
      title="Approvals"
      description="Pending agent actions awaiting operator sign-off."
    >
      {pendingCount > 0 ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2">
            <span className="text-xs font-medium text-amber-200">
              {pendingCount} pending approval{pendingCount !== 1 ? "s" : ""}
            </span>
          </div>
          {oldest && (
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{oldest.agent}</span>
                <span className="text-[10px] uppercase text-muted-foreground">{oldest.riskLevel}</span>
              </div>
              <p className="mt-0.5 text-muted-foreground line-clamp-1">{oldest.action}</p>
            </div>
          )}
          <Link
            href="/approvals"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Review approvals
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center">
          <ShieldCheck className="mx-auto mb-1 h-5 w-5 text-emerald-400/50" />
          <p className="text-xs text-muted-foreground">All clear. No approvals waiting.</p>
        </div>
      )}
    </Panel>
  );
}

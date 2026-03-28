"use client";

import { cn } from "@/lib/utils";
import type { Approval, ApprovalRiskLevel } from "@/src/types/approvals";

const RISK_COLORS: Record<ApprovalRiskLevel, string> = {
  critical: "bg-red-500/15 text-red-300 border-red-500/35",
  high: "bg-orange-400/15 text-orange-300 border-orange-400/35",
  medium: "bg-amber-400/15 text-amber-200 border-amber-400/35",
  low: "bg-emerald-400/15 text-emerald-300 border-emerald-400/35",
};

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-400/10 text-amber-200 border-amber-400/30" },
  approved: { label: "Approved", className: "bg-emerald-400/10 text-emerald-300 border-emerald-400/30" },
  rejected: { label: "Rejected", className: "bg-red-500/10 text-red-300 border-red-500/30" },
  expired: { label: "Expired", className: "bg-muted/50 text-muted-foreground border-border" },
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

interface ApprovalCardProps {
  approval: Approval;
  selected?: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onExpand?: (id: string) => void;
}

export function ApprovalCard({ approval, selected, onApprove, onReject, onExpand }: ApprovalCardProps) {
  const isPending = approval.status === "pending";
  const statusBadge = STATUS_BADGE[approval.status];
  const riskColor = RISK_COLORS[approval.riskLevel];
  const isResolved = !isPending;

  return (
    <div
      className={cn(
        "group rounded-lg border border-border/60 bg-background/35 px-3 py-2.5 transition-colors",
        selected && "border-accent/50 bg-accent/10",
        isResolved && "opacity-60",
      )}
      data-approval-id={approval.id}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          {/* Risk badge + agent + timestamp */}
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase", riskColor)}>
              {approval.riskLevel}
            </span>
            <span className="text-xs font-medium text-foreground">{approval.agent}</span>
            <span className="text-[11px] text-muted-foreground">{timeAgo(approval.createdAt)}</span>
            {!isPending && (
              <span className={cn("inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium", statusBadge.className)}>
                {statusBadge.label}
              </span>
            )}
          </div>

          {/* Action description — 2 line clamp */}
          <p className="text-xs font-medium text-foreground line-clamp-2">{approval.action}</p>

          {/* Reason */}
          {approval.reason && (
            <p className="mt-0.5 text-[11px] text-muted-foreground line-clamp-1">
              &ldquo;{approval.reason}&rdquo;
            </p>
          )}

          {/* Comment (on resolved) */}
          {approval.comment && (
            <p className="mt-0.5 text-[11px] italic text-muted-foreground line-clamp-1">
              Comment: {approval.comment}
            </p>
          )}
        </div>
      </div>

      {/* Action buttons */}
      <div className="mt-2 flex items-center gap-2">
        {isPending && (
          <>
            <button
              onClick={() => onApprove?.(approval.id)}
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-2.5 py-1 text-[11px] font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
            >
              Approve (a)
            </button>
            <button
              onClick={() => onReject?.(approval.id)}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[11px] font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              Reject (r)
            </button>
          </>
        )}
        <button
          onClick={() => onExpand?.(approval.id)}
          className="rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          Details
        </button>
      </div>
    </div>
  );
}

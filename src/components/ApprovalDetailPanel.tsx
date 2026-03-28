"use client";

import { X } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Approval } from "@/src/types/approvals";

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

interface ApprovalDetailPanelProps {
  approval: Approval;
  onClose: () => void;
  onApprove?: (id: string, comment?: string) => void;
  onReject?: (id: string, comment?: string) => void;
}

export function ApprovalDetailPanel({ approval, onClose, onApprove, onReject }: ApprovalDetailPanelProps) {
  const [comment, setComment] = useState("");
  const isPending = approval.status === "pending";

  return (
    <div className="glass-panel rounded-xl p-4 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-medium text-foreground">{approval.action}</h3>
          <p className="text-[11px] text-muted-foreground">
            {approval.agent} &middot; {formatTimestamp(approval.createdAt)}
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
          <span className="font-medium capitalize">{approval.status}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Risk level</span>
          <span className="font-medium uppercase">{approval.riskLevel}</span>
        </div>
        {approval.reason && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Reason</span>
            <span className="text-right">{approval.reason}</span>
          </div>
        )}
        {approval.refId && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Ref</span>
            <span className="font-mono">{approval.refId}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Expires</span>
          <span>{formatTimestamp(approval.expiresAt)}</span>
        </div>
        {approval.resolvedAt && (
          <div className="flex justify-between">
            <span className="text-muted-foreground">Resolved</span>
            <span>{formatTimestamp(approval.resolvedAt)}</span>
          </div>
        )}
        {approval.comment && (
          <div className="flex justify-between gap-4">
            <span className="shrink-0 text-muted-foreground">Comment</span>
            <span className="text-right italic">{approval.comment}</span>
          </div>
        )}
      </div>

      {/* Context */}
      {approval.context && (
        <div>
          <div className="mb-1 text-[11px] font-medium text-muted-foreground">Context</div>
          <pre className={cn(
            "max-h-48 overflow-auto rounded-md border border-border/60 bg-background/35 p-2 font-mono text-[11px] text-muted-foreground",
          )}>
            {tryParseJson(approval.context)}
          </pre>
        </div>
      )}

      {/* Actions */}
      {isPending && (
        <div className="space-y-2">
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Optional comment..."
            className="w-full resize-none rounded-md border border-border/60 bg-background/35 px-2 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:border-accent/50 focus:outline-none"
            rows={2}
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => onApprove?.(approval.id, comment || undefined)}
              className="rounded-md border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-medium text-emerald-300 transition-colors hover:bg-emerald-400/20"
            >
              Approve
            </button>
            <button
              onClick={() => onReject?.(approval.id, comment || undefined)}
              className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-300 transition-colors hover:bg-red-500/20"
            >
              Reject
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

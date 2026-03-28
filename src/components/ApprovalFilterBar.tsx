"use client";

import { cn } from "@/lib/utils";
import type { ApprovalStatus } from "@/src/types/approvals";

const FILTERS: { label: string; value: ApprovalStatus | null }[] = [
  { label: "Pending", value: "pending" },
  { label: "Approved", value: "approved" },
  { label: "Rejected", value: "rejected" },
  { label: "Expired", value: "expired" },
  { label: "All", value: null },
];

interface ApprovalFilterBarProps {
  active: ApprovalStatus | null;
  onChange: (status: ApprovalStatus | null) => void;
}

export function ApprovalFilterBar({ active, onChange }: ApprovalFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-filter-bar>
      {FILTERS.map((f) => (
        <button
          key={f.label}
          onClick={() => onChange(f.value)}
          className={cn(
            "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
            active === f.value
              ? "bg-accent/35 text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
          )}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function ApprovalsBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    fetch("/api/approvals?status=pending&limit=1")
      .then((r) => r.json())
      .then((data) => setCount(data.pending_count ?? 0))
      .catch(() => {});

    // SSE for live updates
    const es = new EventSource("/api/approvals/stream");

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setCount(data.pendingCount ?? 0);
    });

    es.addEventListener("approval", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "approval.requested") {
        setCount((c) => c + 1);
      } else if (
        event.type === "approval.approved" ||
        event.type === "approval.rejected" ||
        event.type === "approval.expired"
      ) {
        setCount((c) => Math.max(0, c - 1));
      }
    });

    return () => es.close();
  }, []);

  if (count <= 0) return null;

  return (
    <span
      className={cn(
        "ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-amber-400/20 px-1 text-[10px] font-semibold text-amber-200",
        count > 0 && "animate-pulse",
      )}
    >
      {count}
    </span>
  );
}

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

export function RetriesBadge() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Initial fetch
    fetch("/api/retries?status=failed&limit=1")
      .then((r) => r.json())
      .then((data) => setCount(data.failed_count ?? 0))
      .catch(() => {});

    // SSE for live updates
    const es = new EventSource("/api/retries/stream");

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setCount(data.failedCount ?? 0);
    });

    es.addEventListener("retry", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "retry.created") {
        setCount((c) => c + 1);
      } else if (
        event.type === "retry.resolved" ||
        event.type === "retry.dismissed"
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
        "ml-auto inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500/20 px-1 text-[10px] font-semibold text-red-300",
        count > 0 && "animate-pulse",
      )}
    >
      {count}
    </span>
  );
}

import { useMemo } from "react";

import type { DashboardSnapshotDto } from "@/src/runtime/dashboard/types";

export interface RuntimeLogLineViewModel {
  id: string;
  message: string;
  timestampLabel: string;
}

function formatTimestamp(iso: string) {
  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function useLogsViewModel(snapshot: DashboardSnapshotDto) {
  return useMemo(() => {
    const lines: RuntimeLogLineViewModel[] = snapshot.recentLogs.map((entry) => ({
      id: entry.id,
      message: entry.message,
      timestampLabel: formatTimestamp(entry.createdAtIso),
    }));

    return {
      lines,
      countLabel: String(lines.length),
      hasLines: lines.length > 0,
    };
  }, [snapshot.recentLogs]);
}

import { useMemo } from "react";

import type { DashboardSnapshotDto } from "@/src/runtime/dashboard/types";

export interface TaskLaneViewModel {
  lane: string;
  label: string;
  stateLabel: string;
  countLabel: string;
  etaLabel: string;
}

export interface TasksSummaryViewModel {
  runningTasksLabel: string;
  blockedTasksLabel: string;
  waitingReviewLabel: string;
}

function formatEta(minutes: number | null) {
  return minutes == null ? "unknown" : `~${minutes}m`;
}

export function useTasksViewModel(snapshot: DashboardSnapshotDto) {
  return useMemo(() => {
    const lanes: TaskLaneViewModel[] = snapshot.queueSnapshot.map((lane) => ({
      lane: lane.lane,
      label: lane.label,
      stateLabel: lane.stateLabel,
      countLabel: String(lane.count),
      etaLabel: formatEta(lane.etaMinutes),
    }));

    const blocked = snapshot.queueSnapshot.find((lane) => lane.lane === "blocked")?.count ?? 0;
    const review = snapshot.queueSnapshot.find((lane) => lane.lane === "review")?.count ?? 0;
    const running = snapshot.queueSnapshot.filter((lane) => lane.lane !== "blocked").reduce((sum, lane) => sum + lane.count, 0);

    const summary: TasksSummaryViewModel = {
      runningTasksLabel: String(running),
      blockedTasksLabel: String(blocked),
      waitingReviewLabel: String(review),
    };

    return {
      lanes,
      summary,
    };
  }, [snapshot.queueSnapshot]);
}

import { useMemo } from "react";

import type { DashboardSnapshotDto, TaskQueueLaneDto } from "@/src/runtime/dashboard/types";

export interface TaskCardViewModel {
  id: string;
  title: string;
  lane: string;
  laneLabel: string;
  status: string;
  assignee: string;
  priority: "P0" | "P1" | "P2" | "P3";
  updatedAtLabel: string;
  etaLabel: string;
  summary: string;
  detail: string;
  blockingReason?: string;
  model: string;
}

export interface TaskLaneViewModel extends TaskQueueLaneDto {
  countLabel: string;
  etaLabel: string;
}

export interface TasksSummaryViewModel {
  totalTasksLabel: string;
  blockedTasksLabel: string;
  reviewTasksLabel: string;
  activeLanesLabel: string;
}

function formatEta(minutes: number | null) {
  return minutes == null ? "unknown" : `~${minutes}m`;
}

function formatRelativeTime(minutesAgo: number) {
  if (minutesAgo <= 1) return "1m ago";
  return `${minutesAgo}m ago`;
}

const taskSeed: Omit<TaskCardViewModel, "lane" | "laneLabel">[] = [
  {
    id: "T-584",
    title: "Promote scheduler pulse to NOW lane",
    status: "in progress",
    assignee: "Planner",
    priority: "P1",
    updatedAtLabel: formatRelativeTime(4),
    etaLabel: "~12m",
    summary: "A fresh runtime pulse was detected and is being normalized into the active queue.",
    detail: "Scheduler reconciles stale tasks, reorders lane depth, and emits a new runtime cursor once the queue state settles.",
    model: "gpt-5.4",
  },
  {
    id: "T-571",
    title: "Unstick ops worker session",
    status: "blocked",
    assignee: "Ops",
    priority: "P0",
    updatedAtLabel: formatRelativeTime(11),
    etaLabel: "unknown",
    summary: "A worker has missed several heartbeats and needs manual confirmation.",
    detail: "The task is waiting on a restarted local transport session before it can be safely retried.",
    blockingReason: "No heartbeat for 11m on ops lane.",
    model: "o3",
  },
  {
    id: "T-612",
    title: "Review ticket 4 merge",
    status: "awaiting review",
    assignee: "Coder",
    priority: "P2",
    updatedAtLabel: formatRelativeTime(18),
    etaLabel: "~9m",
    summary: "Merged work is queued for lint/build confirmation before it can be promoted.",
    detail: "The review card is holding the line until the build remains green and the shell is validated on the Tasks page.",
    model: "gpt-5.3-codex",
  },
  {
    id: "T-618",
    title: "Refresh routing fallback policy",
    status: "queued",
    assignee: "Research",
    priority: "P3",
    updatedAtLabel: formatRelativeTime(27),
    etaLabel: "~31m",
    summary: "Model share is being rebalanced after a fallback spike.",
    detail: "This task watches the router and prepares a safer default when high-latency models trend upward.",
    model: "gpt-4.1",
  },
  {
    id: "T-601",
    title: "Finalize cost watch alert",
    status: "done",
    assignee: "Planner",
    priority: "P2",
    updatedAtLabel: formatRelativeTime(42),
    etaLabel: "done",
    summary: "Budget guardrails were confirmed and the alert was dismissed.",
    detail: "Historical spend is now visible in the dashboard and the cost threshold is tracked via runtime metrics.",
    model: "gpt-5.4",
  },
];

function taskForLane(lane: TaskQueueLaneDto, index: number): TaskCardViewModel[] {
  const items = taskSeed.filter((task) => {
    if (lane.lane === "now") return ["in progress", "queued"].includes(task.status);
    if (lane.lane === "next") return ["queued"].includes(task.status);
    if (lane.lane === "blocked") return task.status === "blocked";
    return ["awaiting review", "done"].includes(task.status);
  });

  return items.map((task, taskIndex) => ({
    ...task,
    lane: lane.lane,
    laneLabel: lane.label,
    updatedAtLabel: task.updatedAtLabel,
    summary: task.summary,
    detail: task.detail,
    title: task.title,
    id: `${task.id}-${index}-${taskIndex}`,
  }));
}

export function useTasksViewModel(snapshot: DashboardSnapshotDto) {
  return useMemo(() => {
    const lanes: TaskLaneViewModel[] = snapshot.queueSnapshot.map((lane) => ({
      ...lane,
      countLabel: String(lane.count),
      etaLabel: formatEta(lane.etaMinutes),
    }));

    const cards = snapshot.queueSnapshot.flatMap((lane, index) => taskForLane(lane, index));
    const blocked = snapshot.queueSnapshot.find((lane) => lane.lane === "blocked")?.count ?? 0;
    const review = snapshot.queueSnapshot.find((lane) => lane.lane === "review")?.count ?? 0;
    const active = snapshot.queueSnapshot.filter((lane) => lane.lane === "now" || lane.lane === "next").reduce((sum, lane) => sum + lane.count, 0);

    const summary: TasksSummaryViewModel = {
      totalTasksLabel: String(cards.length),
      blockedTasksLabel: String(blocked),
      reviewTasksLabel: String(review),
      activeLanesLabel: String(active),
    };

    return {
      lanes,
      cards,
      summary,
    };
  }, [snapshot.queueSnapshot]);
}

import { useMemo } from "react";
import type { DashboardSnapshotDto, TaskQueueLaneDto } from "@/src/runtime/dashboard/types";
import type { Task, TaskLane } from "@/src/runtime/tasks/store";

export interface TaskCardViewModel extends Task {
  laneLabel: string;
  etaLabel: string;
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

const laneLabels: Record<TaskLane, string> = {
  now: "NOW",
  next: "NEXT",
  review: "REVIEW",
  blocked: "BLOCKED",
  done: "DONE",
};

function taskToCard(task: Task): TaskCardViewModel {
  return {
    ...task,
    laneLabel: laneLabels[task.lane] ?? task.lane.toUpperCase(),
    etaLabel: formatEta(task.etaMinutes),
  };
}

export function useTasksViewModel(snapshot: DashboardSnapshotDto, liveTasks?: Task[]) {
  return useMemo(() => {
    // Prefer live tasks from API; fall back to snapshot-seeded mock
    const tasks: Task[] = liveTasks && liveTasks.length > 0 ? liveTasks : buildSeedTasks();

    const cards = tasks.map(taskToCard);

    const lanes: TaskLaneViewModel[] = (snapshot.queueSnapshot.length > 0 ? snapshot.queueSnapshot : buildLanesFromTasks(tasks)).map((lane) => ({
      ...lane,
      countLabel: String(lane.count),
      etaLabel: formatEta(lane.etaMinutes),
    }));

    const blocked = tasks.filter((t) => t.lane === "blocked").length;
    const review = tasks.filter((t) => t.lane === "review").length;
    const active = tasks.filter((t) => t.lane === "now" || t.lane === "next").length;

    const summary: TasksSummaryViewModel = {
      totalTasksLabel: String(cards.length),
      blockedTasksLabel: String(blocked),
      reviewTasksLabel: String(review),
      activeLanesLabel: String(active),
    };

    return { lanes, cards, summary };
  }, [snapshot, liveTasks]);
}

function buildLanesFromTasks(tasks: Task[]): TaskQueueLaneDto[] {
  const laneOrder = ["now", "next", "review", "blocked"] as const;
  return laneOrder.map((lane) => ({
    lane: lane as TaskQueueLaneDto["lane"],
    label: laneLabels[lane],
    stateLabel: `${tasks.filter((t) => t.lane === lane).length} tasks`,
    count: tasks.filter((t) => t.lane === lane).length,
    etaMinutes: null,
  }));
}

function buildSeedTasks(): Task[] {
  // Mirrors the original taskSeed logic — used only when no live tasks available
  return [
    {
      id: "T-584",
      title: "Promote scheduler pulse to NOW lane",
      lane: "now" as TaskLane,
      status: "in progress",
      assignee: "Planner",
      priority: "P1",
      summary: "A fresh runtime pulse was detected and is being normalized into the active queue.",
      detail: "Scheduler reconciles stale tasks, reorders lane depth, and emits a new runtime cursor once the queue state settles.",
      model: "MiniMax-M2.7",
      createdAt: new Date(Date.now() - 4 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 4 * 60000).toISOString(),
      etaMinutes: 12,
    },
    {
      id: "T-571",
      title: "Unstick ops worker session",
      lane: "blocked" as TaskLane,
      status: "blocked",
      assignee: "Ops",
      priority: "P0",
      summary: "A worker has missed several heartbeats and needs manual confirmation.",
      detail: "The task is waiting on a restarted local transport session before it can be safely retried.",
      blockingReason: "No heartbeat for 11m on ops lane.",
      model: "gpt-5.3-codex",
      createdAt: new Date(Date.now() - 11 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 11 * 60000).toISOString(),
      etaMinutes: null,
    },
    {
      id: "T-612",
      title: "Review ticket 4 merge",
      lane: "review" as TaskLane,
      status: "awaiting review",
      assignee: "Coder",
      priority: "P2",
      summary: "Merged work is queued for lint/build confirmation before it can be promoted.",
      detail: "The review card is holding the line until the build remains green and the shell is validated on the Tasks page.",
      model: "gpt-5.4-mini",
      createdAt: new Date(Date.now() - 18 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 18 * 60000).toISOString(),
      etaMinutes: 9,
    },
    {
      id: "T-618",
      title: "Refresh routing fallback policy",
      lane: "next" as TaskLane,
      status: "queued",
      assignee: "Research",
      priority: "P3",
      summary: "Model share is being rebalanced after a fallback spike.",
      detail: "This task watches the router and prepares a safer default when high-latency models trend upward.",
      model: "MiniMax-M2.7",
      createdAt: new Date(Date.now() - 27 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 27 * 60000).toISOString(),
      etaMinutes: 31,
    },
    {
      id: "T-601",
      title: "Finalize cost watch alert",
      lane: "done" as TaskLane,
      status: "done",
      assignee: "Planner",
      priority: "P2",
      summary: "Budget guardrails were confirmed and the alert was dismissed.",
      detail: "Historical spend is now visible in the dashboard and the cost threshold is tracked via runtime metrics.",
      model: "gpt-5.4",
      createdAt: new Date(Date.now() - 42 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 42 * 60000).toISOString(),
      etaMinutes: null,
    },
  ];
}

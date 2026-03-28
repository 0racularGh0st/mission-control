import { useMemo } from "react";
import type { DashboardSnapshotDto, TaskQueueLaneDto } from "@/src/runtime/dashboard/types";
import type { Task, TaskLane } from "@/src/runtime/tasks/constants";

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
    const tasks: Task[] = liveTasks ?? [];

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


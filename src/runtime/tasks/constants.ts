// Shared task types and constants — safe for client and server imports.
// Keep DB/server logic in store.ts; keep importable values here.

export type TaskLane = "now" | "next" | "review" | "blocked" | "done";
export type TaskAssignee = "Jarvis" | "Cody";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "queued" | "in progress" | "blocked" | "awaiting review" | "done";

/** Canonical ordered list of lanes — single source of truth for types, DB, API, and UI */
export const TASK_LANES: TaskLane[] = ["now", "next", "review", "blocked", "done"];
/** Canonical list of valid assignees — single source of truth for types, DB, API, and UI */
export const TASK_ASSIGNEES: TaskAssignee[] = ["Jarvis", "Cody"];

export interface Task {
  id: string;
  title: string;
  lane: TaskLane;
  status: TaskStatus;
  assignee: TaskAssignee;
  priority: TaskPriority;
  summary: string;
  detail: string;
  blockingReason?: string;
  model: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  etaMinutes: number | null;
}

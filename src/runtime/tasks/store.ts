// In-memory task store — lives in module scope (resets on server restart)
// For production: replace with a DB adapter

export type TaskLane = "now" | "next" | "review" | "blocked" | "done";
export type TaskPriority = "P0" | "P1" | "P2" | "P3";
export type TaskStatus = "queued" | "in progress" | "blocked" | "awaiting review" | "done";

export interface Task {
  id: string;
  title: string;
  lane: TaskLane;
  status: TaskStatus;
  assignee: string;
  priority: TaskPriority;
  summary: string;
  detail: string;
  blockingReason?: string;
  model: string;
  createdAt: string; // ISO
  updatedAt: string; // ISO
  etaMinutes: number | null;
}

const tasks: Task[] = [
  {
    id: "T-584",
    title: "Promote scheduler pulse to NOW lane",
    lane: "now",
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
    lane: "blocked",
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
    lane: "review",
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
    lane: "next",
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
    lane: "done",
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

let nextId = 619;

export function getTasks(): Task[] {
  return [...tasks].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function getTask(id: string): Task | undefined {
  return tasks.find((t) => t.id === id);
}

export function createTask(data: Omit<Task, "id" | "createdAt" | "updatedAt">): Task {
  const task: Task = {
    ...data,
    id: `T-${nextId++}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  tasks.push(task);
  return task;
}

export function updateTask(id: string, data: Partial<Omit<Task, "id" | "createdAt">>): Task | null {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return null;
  tasks[idx] = { ...tasks[idx], ...data, updatedAt: new Date().toISOString() };
  return tasks[idx];
}

export function deleteTask(id: string): boolean {
  const idx = tasks.findIndex((t) => t.id === id);
  if (idx === -1) return false;
  tasks.splice(idx, 1);
  return true;
}

export function moveTask(id: string, lane: TaskLane): Task | null {
  const statusMap: Record<TaskLane, TaskStatus> = {
    now: "in progress",
    next: "queued",
    review: "awaiting review",
    blocked: "blocked",
    done: "done",
  };
  return updateTask(id, { lane, status: statusMap[lane] });
}

// SQLite-backed task store
// Persists tasks across server restarts via the shared DB

import { getDb } from "@/src/server/db";
import { emitTaskEvent } from "./eventsBus";
import { recordEvent } from "@/src/server/timeline";
export { TASK_LANES, TASK_ASSIGNEES } from "./constants";
export type { Task, TaskLane, TaskAssignee, TaskPriority, TaskStatus } from "./constants";

import type { Task, TaskLane, TaskAssignee, TaskPriority, TaskStatus } from "./constants";

interface TaskRow {
  id: string;
  title: string;
  lane: TaskLane;
  status: TaskStatus;
  assignee: TaskAssignee;
  priority: TaskPriority;
  summary: string;
  detail: string;
  blocking_reason: string | null;
  model: string;
  eta_minutes: number | null;
  created_at: string;
  updated_at: string;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    lane: row.lane,
    status: row.status,
    assignee: row.assignee,
    priority: row.priority,
    summary: row.summary,
    detail: row.detail,
    blockingReason: row.blocking_reason ?? undefined,
    model: row.model,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    etaMinutes: row.eta_minutes,
  };
}

function nextId(): string {
  const db = getDb();
  const row = db.prepare("SELECT id FROM tasks ORDER BY CAST(SUBSTR(id, 3) AS INTEGER) DESC LIMIT 1").get() as { id: string } | undefined;
  if (!row) return "T-1";
  const num = parseInt(row.id.replace("T-", ""), 10);
  return `T-${num + 1}`;
}

export function getTasks(): Task[] {
  const db = getDb();
  const rows = db.prepare("SELECT * FROM tasks ORDER BY created_at ASC").all() as TaskRow[];
  return rows.map(rowToTask);
}

export function getTask(id: string): Task | undefined {
  const db = getDb();
  const row = db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as TaskRow | undefined;
  return row ? rowToTask(row) : undefined;
}

export function createTask(data: Omit<Task, "id" | "createdAt" | "updatedAt">): Task {
  const db = getDb();
  const id = nextId();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO tasks (id, title, lane, status, assignee, priority, summary, detail, blocking_reason, model, eta_minutes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, data.title, data.lane, data.status, data.assignee, data.priority, data.summary, data.detail, data.blockingReason ?? null, data.model, data.etaMinutes ?? null, now, now);

  const task = getTask(id)!;
  emitTaskEvent({ type: "task.created", taskId: task.id, task });
  recordEvent("task.created", "tasks", task.id, task.assignee, `Task '${task.title}' created in ${task.lane}`);
  return task;
}

export function updateTask(id: string, data: Partial<Omit<Task, "id" | "createdAt">>, { skipTimeline }: { skipTimeline?: boolean } = {}): Task | null {
  const existing = getTask(id);
  if (!existing) return null;

  const db = getDb();
  const now = new Date().toISOString();

  const merged = { ...existing, ...data, updatedAt: now };

  db.prepare(`
    UPDATE tasks SET title = ?, lane = ?, status = ?, assignee = ?, priority = ?, summary = ?, detail = ?, blocking_reason = ?, model = ?, eta_minutes = ?, updated_at = ?
    WHERE id = ?
  `).run(merged.title, merged.lane, merged.status, merged.assignee, merged.priority, merged.summary, merged.detail, merged.blockingReason ?? null, merged.model, merged.etaMinutes ?? null, now, id);

  const updated = getTask(id)!;
  emitTaskEvent({ type: "task.updated", taskId: id, task: updated });
  if (!skipTimeline) {
    recordEvent("task.updated", "tasks", id, updated.assignee, `Task '${updated.title}' updated`);
  }
  return updated;
}

export function deleteTask(id: string): boolean {
  const db = getDb();
  const existing = getTask(id);
  const result = db.prepare("DELETE FROM tasks WHERE id = ?").run(id);
  if (result.changes === 0) return false;
  emitTaskEvent({ type: "task.deleted", taskId: id });
  recordEvent("task.deleted", "tasks", id, existing?.assignee ?? "system", `Task '${existing?.title ?? id}' deleted`);
  return true;
}

export function moveTask(id: string, lane: TaskLane): Task | null {
  const existing = getTask(id);
  const fromLane = existing?.lane ?? "unknown";
  const statusMap: Record<TaskLane, TaskStatus> = {
    now: "in progress",
    next: "queued",
    review: "awaiting review",
    blocked: "blocked",
    done: "done",
  };
  const updated = updateTask(id, { lane, status: statusMap[lane] }, { skipTimeline: true });
  if (updated) {
    emitTaskEvent({ type: "task.moved", taskId: id, task: updated, lane });
    recordEvent(
      "task.moved", "tasks", id, updated.assignee,
      `Task '${updated.title}' moved → ${lane}`,
      JSON.stringify({ from: fromLane, to: lane }),
    );
  }
  return updated;
}

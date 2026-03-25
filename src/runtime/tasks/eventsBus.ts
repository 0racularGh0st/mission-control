// In-memory task events bus — distributes task mutation events to all connected SSE clients

export type TaskEventType = "task.created" | "task.updated" | "task.moved" | "task.deleted";

export interface TaskEvent {
  type: TaskEventType;
  taskId: string;
  task?: unknown;
  lane?: string;
  timestamp: string;
}

type Listener = (event: TaskEvent) => void;

const listeners = new Set<Listener>();

export function emitTaskEvent(event: Omit<TaskEvent, "timestamp">) {
  const full: TaskEvent = {
    ...event,
    timestamp: new Date().toISOString(),
  };
  for (const listener of listeners) {
    try {
      listener(full);
    } catch {
      // drop failed listeners silently
    }
  }
}

export function subscribeToTaskEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getTaskEventListenerCount(): number {
  return listeners.size;
}

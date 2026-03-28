// In-memory timeline events bus — distributes timeline events to all connected SSE clients

import type { TimelineEvent } from "@/src/types/timeline";

type Listener = (event: TimelineEvent) => void;

const listeners = new Set<Listener>();

export function emitTimelineEvent(event: TimelineEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // drop failed listeners silently
    }
  }
}

export function subscribeToTimelineEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

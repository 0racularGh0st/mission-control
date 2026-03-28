// In-memory retries event bus — distributes retry events to all connected SSE clients

import type { RetryEntry, RetryAttempt } from "@/src/types/retries";

export type RetryEvent =
  | { type: "retry.created"; retry: RetryEntry }
  | { type: "retry.resolved"; retry: RetryEntry; attempt: RetryAttempt }
  | { type: "retry.failed"; retry: RetryEntry; attempt: RetryAttempt }
  | { type: "retry.dismissed"; retry: RetryEntry };

type Listener = (event: RetryEvent) => void;

const listeners = new Set<Listener>();

export function emitRetryEvent(event: RetryEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // drop failed listeners silently
    }
  }
}

export function subscribeToRetryEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

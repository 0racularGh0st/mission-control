// In-memory memory event bus — distributes memory events to all connected SSE clients

import type { MemoryEntry, MemoryScanResult } from "@/src/types/memory";

export type MemoryEvent =
  | { type: "memory.scanned"; result: MemoryScanResult }
  | { type: "memory.deleted"; entryId: string }
  | { type: "memory.updated"; entry: MemoryEntry };

type Listener = (event: MemoryEvent) => void;

const listeners = new Set<Listener>();

export function emitMemoryEvent(event: MemoryEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // drop failed listeners silently
    }
  }
}

export function subscribeToMemoryEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

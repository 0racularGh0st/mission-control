// In-memory approvals event bus — distributes approval events to all connected SSE clients

import type { Approval } from "@/src/types/approvals";

export type ApprovalEvent =
  | { type: "approval.requested"; approval: Approval }
  | { type: "approval.approved"; approval: Approval }
  | { type: "approval.rejected"; approval: Approval }
  | { type: "approval.expired"; approval: Approval };

type Listener = (event: ApprovalEvent) => void;

const listeners = new Set<Listener>();

export function emitApprovalEvent(event: ApprovalEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch {
      // drop failed listeners silently
    }
  }
}

export function subscribeToApprovalEvents(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Timeline event types — shared across client and server

export type TimelineSource = "tasks" | "agents" | "sessions";

export type TimelineEventType =
  | "task.created"
  | "task.moved"
  | "task.updated"
  | "task.deleted"
  | "agent.started"
  | "agent.completed"
  | "agent.failed"
  | "session.started"
  | "session.ended"
  | "cost.spike"
  | "approval.requested"
  | "approval.approved"
  | "approval.rejected"
  | "approval.expired"
  | "retry.created"
  | "retry.resolved"
  | "retry.failed"
  | "retry.dismissed"
  | "memory.scanned"
  | "memory.deleted";

export const TIMELINE_SOURCES: TimelineSource[] = ["tasks", "agents", "sessions"];

export interface TimelineEvent {
  id: string;
  eventType: TimelineEventType;
  source: TimelineSource;
  refId: string;
  actor: string;
  title: string;
  detail: string;
  occurredAt: string; // ISO
  createdAt: string; // ISO
}

export interface TimelineResponse {
  events: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
}

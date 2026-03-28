// Retry types — shared across client and server

export type RetrySource = "agents" | "tasks" | "sessions";
export type RetryStatus = "failed" | "retrying" | "resolved" | "dismissed";

export const RETRY_SOURCES: RetrySource[] = ["agents", "tasks", "sessions"];
export const RETRY_STATUSES: RetryStatus[] = ["failed", "retrying", "resolved", "dismissed"];

export interface RetryEntry {
  id: string;
  source: RetrySource;
  refId: string;
  errorSummary: string;
  errorDetail: string;
  originalParams: string; // JSON string
  status: RetryStatus;
  attemptCount: number;
  maxAttempts: number;
  lastAttemptAt: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

export interface RetryAttempt {
  id: string;
  retryId: string;
  attempt: number;
  outcome: "success" | "failed";
  error: string;
  startedAt: string;
  endedAt: string | null;
}

export interface RetriesResponse {
  retries: RetryEntry[];
  failedCount: number;
  nextCursor: string | null;
  hasMore: boolean;
}

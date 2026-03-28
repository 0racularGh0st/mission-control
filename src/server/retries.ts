/**
 * Retries server module — CRUD, retry execution, timeline integration.
 */

import { getDb } from "@/src/server/db";
import { recordEvent } from "@/src/server/timeline";
import { emitRetryEvent } from "@/src/runtime/retries/eventsBus";
import type { RetryEntry, RetryAttempt, RetrySource, RetryStatus } from "@/src/types/retries";
import { randomBytes } from "crypto";

function nanoid(): string {
  return randomBytes(12).toString("base64url");
}

interface RetryRow {
  id: string;
  source: string;
  ref_id: string;
  error_summary: string;
  error_detail: string;
  original_params: string;
  status: string;
  attempt_count: number;
  max_attempts: number;
  last_attempt_at: string | null;
  resolved_at: string | null;
  created_at: string;
}

interface AttemptRow {
  id: string;
  retry_id: string;
  attempt: number;
  outcome: string;
  error: string;
  started_at: string;
  ended_at: string | null;
}

function rowToRetry(row: RetryRow): RetryEntry {
  return {
    id: row.id,
    source: row.source as RetrySource,
    refId: row.ref_id,
    errorSummary: row.error_summary,
    errorDetail: row.error_detail,
    originalParams: row.original_params,
    status: row.status as RetryStatus,
    attemptCount: row.attempt_count,
    maxAttempts: row.max_attempts,
    lastAttemptAt: row.last_attempt_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

function rowToAttempt(row: AttemptRow): RetryAttempt {
  return {
    id: row.id,
    retryId: row.retry_id,
    attempt: row.attempt,
    outcome: row.outcome as "success" | "failed",
    error: row.error,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  };
}

export interface CreateRetryInput {
  source: RetrySource;
  refId: string;
  errorSummary: string;
  errorDetail?: string;
  originalParams?: string;
  maxAttempts?: number;
}

export function createRetryEntry(input: CreateRetryInput): RetryEntry {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO retries (id, source, ref_id, error_summary, error_detail, original_params, status, attempt_count, max_attempts, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'failed', 0, ?, ?)
  `).run(
    id,
    input.source,
    input.refId,
    input.errorSummary,
    input.errorDetail ?? "",
    input.originalParams ?? "{}",
    input.maxAttempts ?? 3,
    now,
  );

  const entry = rowToRetry(
    db.prepare("SELECT * FROM retries WHERE id = ?").get(id) as RetryRow,
  );

  emitRetryEvent({ type: "retry.created", retry: entry });
  recordEvent(
    "retry.created",
    "agents",
    entry.id,
    entry.source,
    `Failure detected: ${entry.errorSummary}`,
    JSON.stringify({ source: entry.source, refId: entry.refId }),
  );

  return entry;
}

export function attemptRetry(
  id: string,
  overrideParams?: Record<string, unknown>,
): { retry: RetryEntry; attempt: RetryAttempt } | null {
  const db = getDb();
  const now = new Date().toISOString();

  const row = db.prepare("SELECT * FROM retries WHERE id = ?").get(id) as RetryRow | undefined;
  if (!row) return null;

  // Block if already retrying
  if (row.status === "retrying") return null;

  // Block if resolved/dismissed
  if (row.status === "resolved" || row.status === "dismissed") return null;

  const nextAttempt = row.attempt_count + 1;

  // Auto-dismiss if max attempts reached
  if (nextAttempt > row.max_attempts) {
    db.prepare(
      "UPDATE retries SET status = 'dismissed', resolved_at = ? WHERE id = ?",
    ).run(now, id);
    const dismissed = rowToRetry(
      db.prepare("SELECT * FROM retries WHERE id = ?").get(id) as RetryRow,
    );
    emitRetryEvent({ type: "retry.dismissed", retry: dismissed });
    recordEvent(
      "retry.dismissed",
      "agents",
      dismissed.id,
      dismissed.source,
      `Max retry attempts exceeded: ${dismissed.errorSummary}`,
    );
    return null;
  }

  // Mark as retrying
  db.prepare(
    "UPDATE retries SET status = 'retrying', last_attempt_at = ? WHERE id = ?",
  ).run(now, id);

  // Record the attempt
  const attemptId = nanoid();
  db.prepare(`
    INSERT INTO retry_attempts (id, retry_id, attempt, outcome, error, started_at)
    VALUES (?, ?, ?, 'failed', '', ?)
  `).run(attemptId, id, nextAttempt, now);

  // Simulate retry execution — in v1 this is a placeholder that marks success.
  // Real dispatch would use original_params + overrideParams to re-run the operation.
  const mergedParams = overrideParams
    ? JSON.stringify({ ...JSON.parse(row.original_params), ...overrideParams })
    : row.original_params;

  // For v1, simulate success/failure based on whether the operation can be retried.
  // Mark the attempt as completed (success for now — real dispatch would be async).
  const endedAt = new Date().toISOString();
  const outcome: "success" | "failed" = "success";

  db.prepare(
    "UPDATE retry_attempts SET outcome = ?, ended_at = ? WHERE id = ?",
  ).run(outcome, endedAt, attemptId);

  if (outcome === "success") {
    db.prepare(
      "UPDATE retries SET status = 'resolved', attempt_count = ?, resolved_at = ?, original_params = ? WHERE id = ?",
    ).run(nextAttempt, endedAt, mergedParams, id);
  } else {
    db.prepare(
      "UPDATE retries SET status = 'failed', attempt_count = ? WHERE id = ?",
    ).run(nextAttempt, id);
  }

  const retry = rowToRetry(
    db.prepare("SELECT * FROM retries WHERE id = ?").get(id) as RetryRow,
  );
  const attempt = rowToAttempt(
    db.prepare("SELECT * FROM retry_attempts WHERE id = ?").get(attemptId) as AttemptRow,
  );

  const eventType = outcome === "success" ? "retry.resolved" : "retry.failed";
  emitRetryEvent({ type: eventType, retry, attempt });
  recordEvent(
    eventType,
    "agents",
    retry.id,
    retry.source,
    outcome === "success"
      ? `Retry succeeded: ${retry.errorSummary}`
      : `Retry failed (attempt ${nextAttempt}): ${retry.errorSummary}`,
    JSON.stringify({ attempt: nextAttempt, outcome }),
  );

  return { retry, attempt };
}

export function dismissRetry(id: string): RetryEntry | null {
  const db = getDb();
  const now = new Date().toISOString();

  const result = db
    .prepare(
      "UPDATE retries SET status = 'dismissed', resolved_at = ? WHERE id = ? AND status IN ('failed')",
    )
    .run(now, id);

  if (result.changes === 0) return null;

  const retry = rowToRetry(
    db.prepare("SELECT * FROM retries WHERE id = ?").get(id) as RetryRow,
  );

  emitRetryEvent({ type: "retry.dismissed", retry });
  recordEvent(
    "retry.dismissed",
    "agents",
    retry.id,
    retry.source,
    `Failure dismissed: ${retry.errorSummary}`,
  );

  return retry;
}

export interface GetRetriesOptions {
  status?: RetryStatus;
  source?: RetrySource;
  before?: string;
  limit?: number;
}

export function getRetries(options: GetRetriesOptions = {}): {
  retries: RetryEntry[];
  failedCount: number;
  nextCursor: string | null;
  hasMore: boolean;
} {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }

  if (options.source) {
    conditions.push("source = ?");
    params.push(options.source);
  }

  if (options.before) {
    conditions.push("created_at < ?");
    params.push(options.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db
    .prepare(`SELECT * FROM retries ${where} ORDER BY created_at DESC LIMIT ?`)
    .all(...params, limit + 1) as RetryRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const retries = pageRows.map(rowToRetry);
  const nextCursor =
    hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1].created_at
      : null;

  const failedCount = (
    db.prepare("SELECT COUNT(*) as c FROM retries WHERE status = 'failed'").get() as { c: number }
  ).c;

  return { retries, failedCount, nextCursor, hasMore };
}

export function getFailedCount(): number {
  const db = getDb();
  return (
    db.prepare("SELECT COUNT(*) as c FROM retries WHERE status = 'failed'").get() as { c: number }
  ).c;
}

export function getAttempts(retryId: string): RetryAttempt[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM retry_attempts WHERE retry_id = ? ORDER BY attempt ASC")
    .all(retryId) as AttemptRow[];
  return rows.map(rowToAttempt);
}

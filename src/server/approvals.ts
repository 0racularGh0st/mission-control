/**
 * Approvals server module — CRUD, lazy expiry, and timeline integration.
 */

import { getDb } from "@/src/server/db";
import { recordEvent } from "@/src/server/timeline";
import { emitApprovalEvent } from "@/src/runtime/approvals/eventsBus";
import type { Approval, ApprovalRiskLevel, ApprovalStatus } from "@/src/types/approvals";
import { randomBytes } from "crypto";

function nanoid(): string {
  return randomBytes(12).toString("base64url");
}

interface ApprovalRow {
  id: string;
  agent: string;
  action: string;
  reason: string;
  risk_level: string;
  context: string;
  status: string;
  comment: string;
  ref_id: string;
  expires_at: string;
  resolved_at: string | null;
  created_at: string;
}

function rowToApproval(row: ApprovalRow): Approval {
  return {
    id: row.id,
    agent: row.agent,
    action: row.action,
    reason: row.reason,
    riskLevel: row.risk_level as ApprovalRiskLevel,
    context: row.context,
    status: row.status as ApprovalStatus,
    comment: row.comment,
    refId: row.ref_id,
    expiresAt: row.expires_at,
    resolvedAt: row.resolved_at,
    createdAt: row.created_at,
  };
}

/** Mark any pending approvals past their expires_at as expired (lazy expiry). */
export function expireStale(): Approval[] {
  const db = getDb();
  const now = new Date().toISOString();

  const staleRows = db
    .prepare("SELECT * FROM approvals WHERE status = 'pending' AND expires_at <= ?")
    .all(now) as ApprovalRow[];

  if (staleRows.length === 0) return [];

  const resolvedAt = now;
  db.prepare(
    "UPDATE approvals SET status = 'expired', resolved_at = ? WHERE status = 'pending' AND expires_at <= ?"
  ).run(resolvedAt, now);

  const expired = staleRows.map((row) =>
    rowToApproval({ ...row, status: "expired", resolved_at: resolvedAt })
  );

  for (const approval of expired) {
    emitApprovalEvent({ type: "approval.expired", approval });
    recordEvent(
      "approval.expired",
      "tasks",
      approval.id,
      approval.agent,
      `Approval expired: ${approval.action}`,
      JSON.stringify({ riskLevel: approval.riskLevel, refId: approval.refId }),
    );
  }

  return expired;
}

export interface CreateApprovalInput {
  agent: string;
  action: string;
  reason?: string;
  riskLevel?: ApprovalRiskLevel;
  context?: string;
  refId?: string;
  ttlMinutes?: number;
}

export function createApproval(input: CreateApprovalInput): Approval {
  const db = getDb();

  // Deduplicate: same agent + action + ref_id within 5-minute window
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  const existing = db
    .prepare(
      "SELECT * FROM approvals WHERE agent = ? AND action = ? AND ref_id = ? AND status = 'pending' AND created_at >= ?"
    )
    .get(input.agent, input.action, input.refId ?? "", fiveMinAgo) as ApprovalRow | undefined;

  if (existing) return rowToApproval(existing);

  const id = nanoid();
  const ttl = input.ttlMinutes ?? 60;
  const expiresAt = new Date(Date.now() + ttl * 60 * 1000).toISOString();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT INTO approvals (id, agent, action, reason, risk_level, context, status, comment, ref_id, expires_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, 'pending', '', ?, ?, ?)
  `).run(
    id,
    input.agent,
    input.action,
    input.reason ?? "",
    input.riskLevel ?? "medium",
    input.context ?? "",
    input.refId ?? "",
    expiresAt,
    now,
  );

  const approval = rowToApproval(
    db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRow
  );

  emitApprovalEvent({ type: "approval.requested", approval });
  recordEvent(
    "approval.requested",
    "tasks",
    approval.id,
    approval.agent,
    `Approval requested: ${approval.action}`,
    JSON.stringify({ riskLevel: approval.riskLevel, refId: approval.refId }),
  );

  return approval;
}

export function resolveApproval(
  id: string,
  resolution: "approve" | "reject",
  comment?: string,
): Approval | null {
  const db = getDb();
  const now = new Date().toISOString();

  // Optimistic lock: only resolve if still pending
  const result = db
    .prepare(
      "UPDATE approvals SET status = ?, comment = ?, resolved_at = ? WHERE id = ? AND status = 'pending'"
    )
    .run(resolution === "approve" ? "approved" : "rejected", comment ?? "", now, id);

  if (result.changes === 0) return null;

  const approval = rowToApproval(
    db.prepare("SELECT * FROM approvals WHERE id = ?").get(id) as ApprovalRow
  );

  const eventType = resolution === "approve" ? "approval.approved" : "approval.rejected";
  emitApprovalEvent({ type: eventType, approval });
  recordEvent(
    eventType,
    "tasks",
    approval.id,
    approval.agent,
    `Approval ${resolution === "approve" ? "approved" : "rejected"}: ${approval.action}`,
    JSON.stringify({ riskLevel: approval.riskLevel, comment: comment ?? "", refId: approval.refId }),
  );

  return approval;
}

export interface GetApprovalsOptions {
  status?: ApprovalStatus;
  agent?: string;
  before?: string;
  limit?: number;
}

export function getApprovals(options: GetApprovalsOptions = {}): {
  approvals: Approval[];
  pendingCount: number;
  nextCursor: string | null;
  hasMore: boolean;
} {
  const db = getDb();

  // Run lazy expiry before reading
  expireStale();

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.status) {
    conditions.push("status = ?");
    params.push(options.status);
  }

  if (options.agent) {
    conditions.push("agent = ?");
    params.push(options.agent);
  }

  if (options.before) {
    conditions.push("created_at < ?");
    params.push(options.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Sort: pending oldest first, resolved newest first
  const orderBy =
    options.status === "pending" ? "created_at ASC" : "created_at DESC";

  const rows = db
    .prepare(`SELECT * FROM approvals ${where} ORDER BY ${orderBy} LIMIT ?`)
    .all(...params, limit + 1) as ApprovalRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const approvals = pageRows.map(rowToApproval);
  const nextCursor =
    hasMore && pageRows.length > 0
      ? pageRows[pageRows.length - 1].created_at
      : null;

  const pendingCount = (
    db.prepare("SELECT COUNT(*) as c FROM approvals WHERE status = 'pending'").get() as { c: number }
  ).c;

  return { approvals, pendingCount, nextCursor, hasMore };
}

export function getPendingCount(): number {
  const db = getDb();
  expireStale();
  return (
    db.prepare("SELECT COUNT(*) as c FROM approvals WHERE status = 'pending'").get() as { c: number }
  ).c;
}

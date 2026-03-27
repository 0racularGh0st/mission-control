/**
 * Agent activity log — backed by SQLite with cursor-based pagination.
 * Drop-in replacement for the old NDJSON file-based log.
 */

import { getDb } from "@/src/server/db";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

/**
 * Log a new agent activity entry.
 */
export function logActivity(entry: AgentActivityEntry): void {
  const db = getDb();
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO agent_activity
      (id, session_key, agent_type, model, started_at, completed_at,
       duration_ms, tokens_in, tokens_out, task_desc, status, result, cost_usd)
    VALUES
      (@id, @sessionKey, @agentType, @model, @startedAt, @completedAt,
       @durationMs, @tokensIn, @tokensOut, @taskDescription, @status, @resultSummary, @estimatedCostUsd)
  `);
  stmt.run(entry);
}

/**
 * Update a running activity entry by session key.
 */
export function updateActivityStatus(
  sessionKey: string,
  updates: Partial<Pick<AgentActivityEntry, "status" | "completedAt" | "durationMs" | "tokensIn" | "tokensOut" | "resultSummary" | "estimatedCostUsd">>,
): void {
  const db = getDb();
  const sets: string[] = [];
  const params: Record<string, unknown> = { sessionKey };

  if (updates.status !== undefined) { sets.push("status = @status"); params.status = updates.status; }
  if (updates.completedAt !== undefined) { sets.push("completed_at = @completedAt"); params.completedAt = updates.completedAt; }
  if (updates.durationMs !== undefined) { sets.push("duration_ms = @durationMs"); params.durationMs = updates.durationMs; }
  if (updates.tokensIn !== undefined) { sets.push("tokens_in = @tokensIn"); params.tokensIn = updates.tokensIn; }
  if (updates.tokensOut !== undefined) { sets.push("tokens_out = @tokensOut"); params.tokensOut = updates.tokensOut; }
  if (updates.resultSummary !== undefined) { sets.push("result = @result"); params.result = updates.resultSummary; }
  if (updates.estimatedCostUsd !== undefined) { sets.push("cost_usd = @costUsd"); params.costUsd = updates.estimatedCostUsd; }

  if (sets.length === 0) return;

  db.prepare(`
    UPDATE agent_activity SET ${sets.join(", ")}
    WHERE session_key = @sessionKey AND status = 'running'
  `).run(params);
}

/**
 * Get recent activities (reverse chronological, most recent first).
 * Used by the activity API route.
 */
export function readActivitiesFromFile(limit = 50): AgentActivityEntry[] {
  const db = getDb();
  const rows = db.prepare(`
    SELECT id, session_key, agent_type, model, started_at, completed_at,
           duration_ms, tokens_in, tokens_out, task_desc, status, result, cost_usd
    FROM agent_activity
    ORDER BY started_at DESC
    LIMIT ?
  `).all(limit) as ActivityRow[];

  return rows.map(rowToEntry);
}

/**
 * Cursor-based pagination for agent activity.
 * Returns entries older than the cursor (started_at ISO string).
 */
export function getActivitiesPaginated(opts: {
  cursor?: string;
  limit?: number;
  agentType?: string;
}): { entries: AgentActivityEntry[]; nextCursor: string | null } {
  const db = getDb();
  const limit = opts.limit ?? 25;
  const conditions: string[] = [];
  const params: Record<string, unknown> = { limit: limit + 1 };

  if (opts.cursor) {
    conditions.push("started_at < @cursor");
    params.cursor = opts.cursor;
  }
  if (opts.agentType) {
    conditions.push("agent_type = @agentType");
    params.agentType = opts.agentType;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const rows = db.prepare(`
    SELECT id, session_key, agent_type, model, started_at, completed_at,
           duration_ms, tokens_in, tokens_out, task_desc, status, result, cost_usd
    FROM agent_activity
    ${where}
    ORDER BY started_at DESC
    LIMIT @limit
  `).all(params) as ActivityRow[];

  const hasMore = rows.length > limit;
  const entries = rows.slice(0, limit).map(rowToEntry);
  const nextCursor = hasMore && entries.length > 0
    ? entries[entries.length - 1].startedAt
    : null;

  return { entries, nextCursor };
}

/**
 * Get activity counts by agent type.
 */
export function getActivityStats(): { agentType: string; count: number; totalCost: number }[] {
  const db = getDb();
  return db.prepare(`
    SELECT agent_type AS agentType, COUNT(*) AS count, COALESCE(SUM(cost_usd), 0) AS totalCost
    FROM agent_activity
    GROUP BY agent_type
    ORDER BY count DESC
  `).all() as { agentType: string; count: number; totalCost: number }[];
}

// Keep these as no-ops for backward compat with sessionMonitor imports
export function getRecentActivities(limit = 50): AgentActivityEntry[] {
  return readActivitiesFromFile(limit);
}

export function resetRingBuffer(): void {
  // no-op — SQLite doesn't need ring buffer reset
}

// --- internal helpers ---

interface ActivityRow {
  id: string;
  session_key: string;
  agent_type: string;
  model: string;
  started_at: string;
  completed_at: string | null;
  duration_ms: number;
  tokens_in: number;
  tokens_out: number;
  task_desc: string;
  status: string;
  result: string;
  cost_usd: number;
}

function rowToEntry(row: ActivityRow): AgentActivityEntry {
  return {
    id: row.id,
    sessionKey: row.session_key,
    agentType: row.agent_type as AgentActivityEntry["agentType"],
    model: row.model,
    startedAt: row.started_at,
    completedAt: row.completed_at ?? row.started_at,
    durationMs: row.duration_ms,
    tokensIn: row.tokens_in,
    tokensOut: row.tokens_out,
    taskDescription: row.task_desc,
    status: row.status as AgentActivityEntry["status"],
    resultSummary: row.result,
    estimatedCostUsd: row.cost_usd,
  };
}

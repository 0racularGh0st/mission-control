/**
 * Timeline event write/read helpers.
 * Events are append-only denormalized snapshots — originating tables remain source of truth.
 */

import { getDb } from "@/src/server/db";
import type { TimelineEvent, TimelineEventType, TimelineSource } from "@/src/types/timeline";
import { randomBytes } from "crypto";
import { emitTimelineEvent } from "@/src/runtime/timeline/eventsBus";

function nanoid(): string {
  return randomBytes(12).toString("base64url");
}

interface TimelineRow {
  id: string;
  event_type: string;
  source: string;
  ref_id: string;
  actor: string;
  title: string;
  detail: string;
  occurred_at: string;
  created_at: string;
}

function rowToEvent(row: TimelineRow): TimelineEvent {
  return {
    id: row.id,
    eventType: row.event_type as TimelineEventType,
    source: row.source as TimelineSource,
    refId: row.ref_id,
    actor: row.actor,
    title: row.title,
    detail: row.detail,
    occurredAt: row.occurred_at,
    createdAt: row.created_at,
  };
}

export function recordEvent(
  type: TimelineEventType,
  source: TimelineSource,
  refId: string,
  actor: string,
  title: string,
  detail?: string,
): TimelineEvent {
  const db = getDb();
  const id = nanoid();
  const now = new Date().toISOString();

  db.prepare(`
    INSERT OR IGNORE INTO timeline_events (id, event_type, source, ref_id, actor, title, detail, occurred_at, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, type, source, refId, actor, title, detail ?? "", now, now);

  const event: TimelineEvent = {
    id,
    eventType: type,
    source,
    refId,
    actor,
    title,
    detail: detail ?? "",
    occurredAt: now,
    createdAt: now,
  };

  emitTimelineEvent(event);
  return event;
}

export interface GetEventsOptions {
  source?: string; // comma-separated sources
  before?: string; // ISO timestamp cursor
  limit?: number; // default 50, max 200
}

export function getTimelineEvents(options: GetEventsOptions = {}): {
  events: TimelineEvent[];
  nextCursor: string | null;
  hasMore: boolean;
} {
  const db = getDb();
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 200);
  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.source) {
    const sources = options.source.split(",").map((s) => s.trim());
    conditions.push(`source IN (${sources.map(() => "?").join(",")})`);
    params.push(...sources);
  }

  if (options.before) {
    conditions.push("occurred_at < ?");
    params.push(options.before);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Fetch one extra to determine hasMore
  const rows = db
    .prepare(`SELECT * FROM timeline_events ${where} ORDER BY occurred_at DESC LIMIT ?`)
    .all(...params, limit + 1) as TimelineRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const events = pageRows.map(rowToEvent);
  const nextCursor = hasMore && pageRows.length > 0 ? pageRows[pageRows.length - 1].occurred_at : null;

  return { events, nextCursor, hasMore };
}

export function getRecentEvents(count: number): TimelineEvent[] {
  const db = getDb();
  const rows = db
    .prepare("SELECT * FROM timeline_events ORDER BY occurred_at DESC LIMIT ?")
    .all(count) as TimelineRow[];
  return rows.map(rowToEvent);
}

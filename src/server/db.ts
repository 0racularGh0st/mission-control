/**
 * SQLite database access layer for Mission Control.
 * Stores agent activity and Claude Code session data.
 */

import Database from "better-sqlite3";
import { join } from "path";
import { mkdirSync, existsSync } from "fs";

const DB_DIR = join(process.env.HOME ?? "/Users/nigel", ".openclaw", "workspace", "data");
const DB_PATH = join(DB_DIR, "claude-sessions.db");

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  if (!existsSync(DB_DIR)) {
    mkdirSync(DB_DIR, { recursive: true });
  }

  _db = new Database(DB_PATH);
  _db.pragma("journal_mode = WAL");
  _db.pragma("foreign_keys = ON");

  runMigrations(_db);
  return _db;
}

function runMigrations(db: Database.Database): void {
  // Migration version tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version    INTEGER PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  const versionRow = db.prepare("SELECT MAX(version) as v FROM schema_migrations").get() as { v: number | null };
  let currentVersion = versionRow.v ?? 0;

  // If tasks table exists but no migrations record, assume v1 was applied (pre-versioning DB)
  if (currentVersion === 0) {
    const existing = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='tasks'").get() as { name: string } | undefined;
    if (existing) {
      db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (1)").run();
      currentVersion = 1;
    }
  }

  // v1 — initial schema
  if (currentVersion < 1) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_activity (
        id            TEXT PRIMARY KEY,
        session_key   TEXT NOT NULL,
        agent_type    TEXT NOT NULL CHECK(agent_type IN ('jarvis','cody','sandra','subagent')),
        model         TEXT NOT NULL DEFAULT 'unknown',
        started_at    TEXT NOT NULL,
        completed_at  TEXT,
        duration_ms   INTEGER NOT NULL DEFAULT 0,
        tokens_in     INTEGER NOT NULL DEFAULT 0,
        tokens_out    INTEGER NOT NULL DEFAULT 0,
        task_desc     TEXT NOT NULL DEFAULT '',
        status        TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed')),
        result        TEXT NOT NULL DEFAULT '',
        cost_usd      REAL NOT NULL DEFAULT 0,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_activity_started ON agent_activity(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_activity_agent   ON agent_activity(agent_type);
      CREATE INDEX IF NOT EXISTS idx_activity_session ON agent_activity(session_key);

      CREATE TABLE IF NOT EXISTS claude_sessions (
        session_id    TEXT PRIMARY KEY,
        project       TEXT NOT NULL DEFAULT '',
        cwd           TEXT NOT NULL DEFAULT '',
        started_at    TEXT NOT NULL,
        ended_at      TEXT,
        entrypoint    TEXT NOT NULL DEFAULT 'cli',
        model         TEXT NOT NULL DEFAULT 'unknown',
        input_tokens  INTEGER NOT NULL DEFAULT 0,
        output_tokens INTEGER NOT NULL DEFAULT 0,
        cache_read    INTEGER NOT NULL DEFAULT 0,
        cache_create  INTEGER NOT NULL DEFAULT 0,
        cost_usd      REAL NOT NULL DEFAULT 0,
        duration_ms   INTEGER NOT NULL DEFAULT 0,
        message_count INTEGER NOT NULL DEFAULT 0,
        transcript    TEXT NOT NULL DEFAULT '',
        git_branch    TEXT NOT NULL DEFAULT '',
        version       TEXT NOT NULL DEFAULT '',
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_claude_started ON claude_sessions(started_at DESC);
      CREATE INDEX IF NOT EXISTS idx_claude_project ON claude_sessions(project);

      CREATE TABLE IF NOT EXISTS tasks (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        lane             TEXT NOT NULL CHECK(lane IN ('now','next','review','blocked','done')),
        status           TEXT NOT NULL CHECK(status IN ('queued','in progress','blocked','awaiting review','done')),
        assignee         TEXT NOT NULL DEFAULT '',
        priority         TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')),
        summary          TEXT NOT NULL DEFAULT '',
        detail           TEXT NOT NULL DEFAULT '',
        blocking_reason  TEXT,
        model            TEXT NOT NULL DEFAULT '',
        eta_minutes      INTEGER,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (1)").run();
    currentVersion = 1;
  }

  // v2 — enforce assignee CHECK constraint (Jarvis | Cody)
  if (currentVersion < 2) {
    // Normalize any pre-existing free-text assignees to 'Jarvis' before adding constraint
    db.exec(`
      UPDATE tasks SET assignee = 'Jarvis' WHERE assignee NOT IN ('Jarvis', 'Cody');

      CREATE TABLE tasks_v2 (
        id               TEXT PRIMARY KEY,
        title            TEXT NOT NULL,
        lane             TEXT NOT NULL CHECK(lane IN ('now','next','review','blocked','done')),
        status           TEXT NOT NULL CHECK(status IN ('queued','in progress','blocked','awaiting review','done')),
        assignee         TEXT NOT NULL DEFAULT 'Jarvis' CHECK(assignee IN ('Jarvis','Cody')),
        priority         TEXT NOT NULL CHECK(priority IN ('P0','P1','P2','P3')),
        summary          TEXT NOT NULL DEFAULT '',
        detail           TEXT NOT NULL DEFAULT '',
        blocking_reason  TEXT,
        model            TEXT NOT NULL DEFAULT '',
        eta_minutes      INTEGER,
        created_at       TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at       TEXT NOT NULL DEFAULT (datetime('now'))
      );

      INSERT INTO tasks_v2 SELECT * FROM tasks;

      DROP TABLE tasks;

      ALTER TABLE tasks_v2 RENAME TO tasks;

      CREATE INDEX IF NOT EXISTS idx_tasks_lane ON tasks(lane);
      CREATE INDEX IF NOT EXISTS idx_tasks_created ON tasks(created_at DESC);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (2)").run();
    currentVersion = 2;
  }

  // v3 — timeline_events table for unified activity feed
  if (currentVersion < 3) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS timeline_events (
        id          TEXT PRIMARY KEY,
        event_type  TEXT NOT NULL,
        source      TEXT NOT NULL CHECK(source IN ('tasks','agents','sessions','costs')),
        ref_id      TEXT NOT NULL DEFAULT '',
        actor       TEXT NOT NULL DEFAULT '',
        title       TEXT NOT NULL,
        detail      TEXT NOT NULL DEFAULT '',
        occurred_at TEXT NOT NULL DEFAULT (datetime('now')),
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_timeline_occurred ON timeline_events(occurred_at DESC);
      CREATE INDEX IF NOT EXISTS idx_timeline_source   ON timeline_events(source);
      CREATE INDEX IF NOT EXISTS idx_timeline_ref      ON timeline_events(ref_id);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (3)").run();
    currentVersion = 3;
  }

  // v4 — approvals table for human-in-the-loop control plane
  if (currentVersion < 4) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS approvals (
        id          TEXT PRIMARY KEY,
        agent       TEXT NOT NULL,
        action      TEXT NOT NULL,
        reason      TEXT NOT NULL DEFAULT '',
        risk_level  TEXT NOT NULL DEFAULT 'medium'
                    CHECK(risk_level IN ('low','medium','high','critical')),
        context     TEXT NOT NULL DEFAULT '',
        status      TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending','approved','rejected','expired')),
        comment     TEXT NOT NULL DEFAULT '',
        ref_id      TEXT NOT NULL DEFAULT '',
        expires_at  TEXT NOT NULL,
        resolved_at TEXT,
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_approvals_status  ON approvals(status);
      CREATE INDEX IF NOT EXISTS idx_approvals_created ON approvals(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_approvals_agent   ON approvals(agent);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (4)").run();
    currentVersion = 4;
  }

  // v5 — retries + retry_attempts tables for Retry Center
  if (currentVersion < 5) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS retries (
        id              TEXT PRIMARY KEY,
        source          TEXT NOT NULL CHECK(source IN ('agents','tasks','sessions')),
        ref_id          TEXT NOT NULL,
        error_summary   TEXT NOT NULL,
        error_detail    TEXT NOT NULL DEFAULT '',
        original_params TEXT NOT NULL DEFAULT '{}',
        status          TEXT NOT NULL DEFAULT 'failed'
                        CHECK(status IN ('failed','retrying','resolved','dismissed')),
        attempt_count   INTEGER NOT NULL DEFAULT 0,
        max_attempts    INTEGER NOT NULL DEFAULT 3,
        last_attempt_at TEXT,
        resolved_at     TEXT,
        created_at      TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_retries_status  ON retries(status);
      CREATE INDEX IF NOT EXISTS idx_retries_source  ON retries(source);
      CREATE INDEX IF NOT EXISTS idx_retries_created ON retries(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_retries_ref     ON retries(ref_id);

      CREATE TABLE IF NOT EXISTS retry_attempts (
        id         TEXT PRIMARY KEY,
        retry_id   TEXT NOT NULL REFERENCES retries(id),
        attempt    INTEGER NOT NULL,
        outcome    TEXT NOT NULL CHECK(outcome IN ('success','failed')),
        error      TEXT NOT NULL DEFAULT '',
        started_at TEXT NOT NULL DEFAULT (datetime('now')),
        ended_at   TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_retry_attempts_retry ON retry_attempts(retry_id);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (5)").run();
  }

  // v6 — memory_entries + memory_edges for Agent Memory Graph
  if (currentVersion < 6) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS memory_entries (
        id            TEXT PRIMARY KEY,
        source_path   TEXT NOT NULL UNIQUE,
        agent         TEXT NOT NULL DEFAULT 'system',
        name          TEXT NOT NULL,
        description   TEXT NOT NULL DEFAULT '',
        mem_type      TEXT NOT NULL DEFAULT 'project'
                      CHECK(mem_type IN ('user','feedback','project','reference')),
        content       TEXT NOT NULL,
        topics        TEXT NOT NULL DEFAULT '[]',
        file_hash     TEXT NOT NULL,
        discovered_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );

      CREATE INDEX IF NOT EXISTS idx_memory_agent   ON memory_entries(agent);
      CREATE INDEX IF NOT EXISTS idx_memory_type    ON memory_entries(mem_type);
      CREATE INDEX IF NOT EXISTS idx_memory_updated ON memory_entries(updated_at DESC);

      CREATE TABLE IF NOT EXISTS memory_edges (
        id          TEXT PRIMARY KEY,
        source_id   TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
        target_id   TEXT NOT NULL REFERENCES memory_entries(id) ON DELETE CASCADE,
        edge_type   TEXT NOT NULL
                    CHECK(edge_type IN ('shared_topic','reference','same_agent','temporal')),
        weight      REAL NOT NULL DEFAULT 1.0,
        label       TEXT NOT NULL DEFAULT '',
        UNIQUE(source_id, target_id, edge_type)
      );

      CREATE INDEX IF NOT EXISTS idx_edges_source ON memory_edges(source_id);
      CREATE INDEX IF NOT EXISTS idx_edges_target ON memory_edges(target_id);
    `);
    db.prepare("INSERT OR IGNORE INTO schema_migrations (version) VALUES (6)").run();
  }
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

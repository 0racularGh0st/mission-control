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
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}

/**
 * Scans Claude Code session transcripts from ~/.claude/projects/
 * and ingests them into the claude_sessions SQLite table.
 */

import { readdirSync, readFileSync, existsSync, statSync } from "fs";
import { join, basename } from "path";
import { getDb } from "@/src/server/db";
import { recordEvent } from "@/src/server/timeline";

const CLAUDE_DIR = join(process.env.HOME ?? "/Users/nigel", ".claude");
const PROJECTS_DIR = join(CLAUDE_DIR, "projects");
const SESSIONS_DIR = join(CLAUDE_DIR, "sessions");

// Claude API pricing per 1M tokens (Opus 4.6 / Sonnet 4.6)
const MODEL_PRICING: Record<string, { input: number; output: number; cacheRead: number; cacheCreate: number }> = {
  "claude-opus-4-6":   { input: 15, output: 75, cacheRead: 1.5, cacheCreate: 18.75 },
  "claude-sonnet-4-6": { input: 3,  output: 15, cacheRead: 0.3, cacheCreate: 3.75 },
  "claude-haiku-4-5":  { input: 0.8, output: 4, cacheRead: 0.08, cacheCreate: 1 },
};

function getDefaultPricing() {
  return { input: 15, output: 75, cacheRead: 1.5, cacheCreate: 18.75 };
}

function estimateCost(model: string, inputTokens: number, outputTokens: number, cacheRead: number, cacheCreate: number): number {
  const key = Object.keys(MODEL_PRICING).find((k) => model.includes(k));
  const p = key ? MODEL_PRICING[key] : getDefaultPricing();
  return (inputTokens * p.input + outputTokens * p.output + cacheRead * p.cacheRead + cacheCreate * p.cacheCreate) / 1_000_000;
}

interface SessionMeta {
  pid: number;
  sessionId: string;
  cwd: string;
  startedAt: number;
  kind: string;
  entrypoint: string;
}

interface ParsedSession {
  sessionId: string;
  project: string;
  cwd: string;
  startedAt: string;
  endedAt: string | null;
  entrypoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreate: number;
  costUsd: number;
  durationMs: number;
  messageCount: number;
  transcriptPath: string;
  gitBranch: string;
  version: string;
}

/**
 * Read session metadata from ~/.claude/sessions/*.json
 */
function readSessionMeta(): Map<string, SessionMeta> {
  const meta = new Map<string, SessionMeta>();
  if (!existsSync(SESSIONS_DIR)) return meta;

  for (const file of readdirSync(SESSIONS_DIR)) {
    if (!file.endsWith(".json")) continue;
    try {
      const content = readFileSync(join(SESSIONS_DIR, file), "utf-8");
      const data = JSON.parse(content) as SessionMeta;
      if (data.sessionId) {
        meta.set(data.sessionId, data);
      }
    } catch {
      // skip invalid files
    }
  }
  return meta;
}

/**
 * Parse a single JSONL transcript file and extract usage stats.
 */
function parseTranscript(filePath: string): {
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreate: number;
  messageCount: number;
  firstTimestamp: string | null;
  lastTimestamp: string | null;
  gitBranch: string;
  version: string;
} {
  const content = readFileSync(filePath, "utf-8");
  const lines = content.split("\n").filter(Boolean);

  let model = "unknown";
  let inputTokens = 0;
  let outputTokens = 0;
  let cacheRead = 0;
  let cacheCreate = 0;
  let messageCount = 0;
  let firstTimestamp: string | null = null;
  let lastTimestamp: string | null = null;
  let gitBranch = "";
  let version = "";

  for (const line of lines) {
    try {
      const d = JSON.parse(line);
      const ts = d.timestamp as string | undefined;

      if (ts) {
        if (!firstTimestamp || ts < firstTimestamp) firstTimestamp = ts;
        if (!lastTimestamp || ts > lastTimestamp) lastTimestamp = ts;
      }

      if (d.type === "user" && d.version && !version) {
        version = d.version;
        if (d.gitBranch) gitBranch = d.gitBranch;
      }

      if (d.type === "assistant") {
        const msg = d.message;
        if (!msg) continue;

        if (msg.model && msg.model !== "<synthetic>") {
          model = msg.model;
        }

        const u = msg.usage;
        if (u) {
          messageCount++;
          inputTokens += u.input_tokens ?? 0;
          outputTokens += u.output_tokens ?? 0;
          cacheRead += u.cache_read_input_tokens ?? 0;
          cacheCreate += u.cache_creation_input_tokens ?? 0;
        }
      }
    } catch {
      // skip malformed lines
    }
  }

  return { model, inputTokens, outputTokens, cacheRead, cacheCreate, messageCount, firstTimestamp, lastTimestamp, gitBranch, version };
}

/**
 * Derive a human-readable project name from the project directory name.
 * e.g., "-Users-nigel--openclaw-workspace-projects-mission-control" → "mission-control"
 */
function projectNameFromDir(dirName: string): string {
  // Take the last meaningful segment
  const parts = dirName.replace(/^-/, "").split("-").filter(Boolean);
  // Find the last segment that isn't a common path part
  const skip = new Set(["Users", "nigel", "openclaw", "workspace", "projects", "Personal", "Workspace"]);
  const meaningful = parts.filter((p) => !skip.has(p));
  return meaningful.length > 0 ? meaningful.join("-") : dirName;
}

/**
 * Scan all Claude Code projects and ingest sessions into DB.
 * Skips sessions already in the database.
 */
export function scanAndIngestSessions(): { ingested: number; skipped: number; total: number } {
  if (!existsSync(PROJECTS_DIR)) return { ingested: 0, skipped: 0, total: 0 };

  const db = getDb();
  const existing = new Set(
    (db.prepare("SELECT session_id FROM claude_sessions").all() as { session_id: string }[])
      .map((r) => r.session_id),
  );

  const sessionMeta = readSessionMeta();

  const insert = db.prepare(`
    INSERT OR REPLACE INTO claude_sessions
      (session_id, project, cwd, started_at, ended_at, entrypoint, model,
       input_tokens, output_tokens, cache_read, cache_create, cost_usd,
       duration_ms, message_count, transcript, git_branch, version)
    VALUES
      (@sessionId, @project, @cwd, @startedAt, @endedAt, @entrypoint, @model,
       @inputTokens, @outputTokens, @cacheRead, @cacheCreate, @costUsd,
       @durationMs, @messageCount, @transcriptPath, @gitBranch, @version)
  `);

  let ingested = 0;
  let skipped = 0;
  let total = 0;

  const projectDirs = readdirSync(PROJECTS_DIR).filter((d) => {
    const full = join(PROJECTS_DIR, d);
    return statSync(full).isDirectory() && !d.startsWith(".");
  });

  const insertMany = db.transaction((sessions: ParsedSession[]) => {
    for (const s of sessions) {
      insert.run(s);
    }
  });

  const toInsert: ParsedSession[] = [];

  for (const projDir of projectDirs) {
    const projPath = join(PROJECTS_DIR, projDir);
    const projectName = projectNameFromDir(projDir);
    const files = readdirSync(projPath).filter((f) => f.endsWith(".jsonl") && !f.includes("subagent"));

    for (const file of files) {
      const sessionId = basename(file, ".jsonl");
      total++;

      if (existing.has(sessionId)) {
        // Re-scan if file was modified after last ingest
        const filePath = join(projPath, file);
        const fileStat = statSync(filePath);
        const row = db.prepare("SELECT created_at FROM claude_sessions WHERE session_id = ?").get(sessionId) as { created_at: string } | undefined;
        if (row) {
          const dbTime = new Date(row.created_at).getTime();
          if (fileStat.mtimeMs <= dbTime + 60_000) {
            skipped++;
            continue;
          }
        }
      }

      const filePath = join(projPath, file);
      try {
        const parsed = parseTranscript(filePath);
        const meta = sessionMeta.get(sessionId);

        const startedAt = meta
          ? new Date(meta.startedAt).toISOString()
          : parsed.firstTimestamp ?? new Date().toISOString();

        const endedAt = parsed.lastTimestamp;
        const durationMs = endedAt && startedAt
          ? Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime())
          : 0;

        toInsert.push({
          sessionId,
          project: projectName,
          cwd: meta?.cwd ?? "",
          startedAt,
          endedAt,
          entrypoint: meta?.entrypoint ?? "cli",
          model: parsed.model,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
          cacheRead: parsed.cacheRead,
          cacheCreate: parsed.cacheCreate,
          costUsd: estimateCost(parsed.model, parsed.inputTokens, parsed.outputTokens, parsed.cacheRead, parsed.cacheCreate),
          durationMs,
          messageCount: parsed.messageCount,
          transcriptPath: filePath,
          gitBranch: parsed.gitBranch || "",
          version: parsed.version || "",
        });
        ingested++;
      } catch {
        skipped++;
      }
    }
  }

  if (toInsert.length > 0) {
    insertMany(toInsert);

    // Record timeline events for ingested sessions
    for (const s of toInsert) {
      const eventType = s.endedAt ? "session.ended" : "session.started";
      const costLabel = s.costUsd > 0 ? ` · $${s.costUsd.toFixed(2)}` : "";
      recordEvent(eventType, "sessions", s.sessionId, s.model,
        `Session ${eventType === "session.ended" ? "ended" : "started"} (${s.project})${costLabel}`,
        JSON.stringify({ project: s.project, model: s.model, cost: s.costUsd, messages: s.messageCount }));

      // Cost spike detection for sessions
      if (s.costUsd > 0.10) {
        recordEvent("cost.spike", "costs", s.sessionId, s.model,
          `Cost spike: $${s.costUsd.toFixed(2)} on session (${s.project})`,
          JSON.stringify({ cost: s.costUsd, threshold: 0.10, project: s.project }));
      }
    }
  }

  return { ingested, skipped, total };
}

/**
 * Get Claude Code usage summary.
 */
export function getClaudeUsageSummary(): {
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheCreate: number;
  totalCostUsd: number;
  totalDurationMs: number;
  totalMessages: number;
  byProject: { project: string; sessions: number; costUsd: number; tokens: number }[];
  byModel: { model: string; sessions: number; costUsd: number }[];
} {
  const db = getDb();

  const totals = db.prepare(`
    SELECT
      COUNT(*) AS totalSessions,
      COALESCE(SUM(input_tokens), 0) AS totalInputTokens,
      COALESCE(SUM(output_tokens), 0) AS totalOutputTokens,
      COALESCE(SUM(cache_read), 0) AS totalCacheRead,
      COALESCE(SUM(cache_create), 0) AS totalCacheCreate,
      COALESCE(SUM(cost_usd), 0) AS totalCostUsd,
      COALESCE(SUM(duration_ms), 0) AS totalDurationMs,
      COALESCE(SUM(message_count), 0) AS totalMessages
    FROM claude_sessions
  `).get() as Record<string, number>;

  const byProject = db.prepare(`
    SELECT project, COUNT(*) AS sessions, COALESCE(SUM(cost_usd), 0) AS costUsd,
           COALESCE(SUM(input_tokens + output_tokens), 0) AS tokens
    FROM claude_sessions GROUP BY project ORDER BY sessions DESC
  `).all() as { project: string; sessions: number; costUsd: number; tokens: number }[];

  const byModel = db.prepare(`
    SELECT model, COUNT(*) AS sessions, COALESCE(SUM(cost_usd), 0) AS costUsd
    FROM claude_sessions WHERE model != 'unknown' GROUP BY model ORDER BY sessions DESC
  `).all() as { model: string; sessions: number; costUsd: number }[];

  return { ...totals, byProject, byModel } as ReturnType<typeof getClaudeUsageSummary>;
}

/**
 * Get paginated Claude Code sessions.
 */
export function getClaudeSessionsPaginated(opts: {
  cursor?: string;
  limit?: number;
  project?: string;
}): {
  sessions: ParsedSession[];
  nextCursor: string | null;
} {
  const db = getDb();
  const limit = opts.limit ?? 20;
  const conditions: string[] = [];
  const params: Record<string, unknown> = { limit: limit + 1 };

  if (opts.cursor) {
    conditions.push("started_at < @cursor");
    params.cursor = opts.cursor;
  }
  if (opts.project) {
    conditions.push("project = @project");
    params.project = opts.project;
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  const rows = db.prepare(`
    SELECT session_id, project, cwd, started_at, ended_at, entrypoint, model,
           input_tokens, output_tokens, cache_read, cache_create, cost_usd,
           duration_ms, message_count, transcript, git_branch, version
    FROM claude_sessions
    ${where}
    ORDER BY started_at DESC
    LIMIT @limit
  `).all(params) as SessionRow[];

  const hasMore = rows.length > limit;
  const sessions = rows.slice(0, limit).map(rowToSession);
  const nextCursor = hasMore && sessions.length > 0
    ? sessions[sessions.length - 1].startedAt
    : null;

  return { sessions, nextCursor };
}

interface SessionRow {
  session_id: string;
  project: string;
  cwd: string;
  started_at: string;
  ended_at: string | null;
  entrypoint: string;
  model: string;
  input_tokens: number;
  output_tokens: number;
  cache_read: number;
  cache_create: number;
  cost_usd: number;
  duration_ms: number;
  message_count: number;
  transcript: string;
  git_branch: string;
  version: string;
}

function rowToSession(row: SessionRow): ParsedSession {
  return {
    sessionId: row.session_id,
    project: row.project,
    cwd: row.cwd,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    entrypoint: row.entrypoint,
    model: row.model,
    inputTokens: row.input_tokens,
    outputTokens: row.output_tokens,
    cacheRead: row.cache_read,
    cacheCreate: row.cache_create,
    costUsd: row.cost_usd,
    durationMs: row.duration_ms,
    messageCount: row.message_count,
    transcriptPath: row.transcript,
    gitBranch: row.git_branch,
    version: row.version,
  };
}

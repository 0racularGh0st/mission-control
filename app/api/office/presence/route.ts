import { NextResponse } from "next/server";
import { readFileSync, readdirSync, existsSync, statSync } from "fs";
import { join, basename } from "path";

export const dynamic = "force-dynamic";

/**
 * Office presence API — reads agent sessions.json files directly
 * to determine real-time status of Jarvis and Cody main/direct sessions.
 * Also reads ~/.claude/sessions/*.json for live Claude Code sessions (Claudius).
 *
 * Heuristics:
 *   idle     — no running direct session, or last update > 2 min ago
 *   thinking — running direct session updated within last 30s (actively streaming)
 *   busy     — running direct session updated 30s–2min ago (waiting / between turns)
 */

const OPENCLAW_DIR = join(process.env.HOME ?? "/Users/nigel", ".openclaw");
const CLAUDE_SESSIONS_DIR = join(process.env.HOME ?? "/Users/nigel", ".claude", "sessions");

const AGENTS = [
  {
    name: "jarvis" as const,
    path: join(OPENCLAW_DIR, "agents", "main", "sessions", "sessions.json"),
  },
  {
    name: "cody" as const,
    path: join(OPENCLAW_DIR, "agents", "cody", "sessions", "sessions.json"),
  },
] as const;

type AgentState = "idle" | "thinking" | "busy";

interface SessionRecord {
  sessionId?: string;
  status?: string;
  endedAt?: number;
  updatedAt?: number;
  startedAt?: number;
  inputTokens?: number;
  outputTokens?: number;
  model?: string;
  chatType?: string;
  label?: string;
}

interface PresenceInfo {
  state: AgentState;
  detail: string;
  sessionKey: string | null;
  updatedAt: number | null;
}

/** Returns true if this session key represents a direct/main chat (not cron, not subagent, not slash) */
function isDirectSession(key: string): boolean {
  // Exclude subagents, cron jobs, run duplicates, and slash commands
  if (key.includes(":subagent:")) return false;
  if (key.includes(":cron:")) return false;
  if (key.includes(":run:")) return false;
  if (key.includes(":slash:")) return false;
  // Accept: agent:main:main, agent:main:telegram:direct:*, agent:cody:telegram:direct:*
  return true;
}

function derivePresence(sessionsPath: string, agentLabel: string): PresenceInfo {
  if (!existsSync(sessionsPath)) {
    return { state: "idle", detail: "No session file", sessionKey: null, updatedAt: null };
  }

  try {
    const raw = readFileSync(sessionsPath, "utf-8");
    const data = JSON.parse(raw) as Record<string, SessionRecord>;

    // Find the most-recently-updated direct session that is still running
    let bestRunning: { key: string; record: SessionRecord } | null = null;
    // Also track the most-recently-updated direct session overall (for "just finished" detail)
    let bestAny: { key: string; record: SessionRecord } | null = null;

    for (const [key, record] of Object.entries(data)) {
      if (!isDirectSession(key)) continue;

      const updatedAt = record.updatedAt ?? 0;

      if (!bestAny || updatedAt > (bestAny.record.updatedAt ?? 0)) {
        bestAny = { key, record };
      }

      const isRunning = !record.endedAt && record.status !== "done" && record.status !== "error" && record.status !== "failed";
      if (isRunning && (!bestRunning || updatedAt > (bestRunning.record.updatedAt ?? 0))) {
        bestRunning = { key, record };
      }
    }

    if (bestRunning) {
      const updatedAt = bestRunning.record.updatedAt ?? 0;
      const ageMs = Date.now() - updatedAt;

      if (ageMs < 30_000) {
        // Updated within 30s → actively streaming tokens
        return {
          state: "thinking",
          detail: `${agentLabel} is actively generating`,
          sessionKey: bestRunning.key,
          updatedAt,
        };
      }
      if (ageMs < 120_000) {
        // Updated 30s–2min ago → in session but between turns
        return {
          state: "busy",
          detail: `${agentLabel} is in an active session`,
          sessionKey: bestRunning.key,
          updatedAt,
        };
      }
      // Running but stale > 2min — treat as idle (likely orphaned)
      return {
        state: "idle",
        detail: `${agentLabel} session stale`,
        sessionKey: bestRunning.key,
        updatedAt,
      };
    }

    // No running direct session
    if (bestAny) {
      const updatedAt = bestAny.record.updatedAt ?? 0;
      const ageMs = Date.now() - updatedAt;
      const agoLabel = ageMs < 60_000 ? "just now" : `${Math.round(ageMs / 60_000)}m ago`;
      return {
        state: "idle",
        detail: `Last session ended ${agoLabel}`,
        sessionKey: null,
        updatedAt,
      };
    }

    return { state: "idle", detail: "No sessions found", sessionKey: null, updatedAt: null };
  } catch {
    return { state: "idle", detail: "Error reading sessions", sessionKey: null, updatedAt: null };
  }
}

/** Check if a PID is alive */
function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

interface ClaudeSessionFile {
  pid: number;
  sessionId?: string;
  cwd?: string;
  startedAt?: number;
  kind?: string;
  entrypoint?: string;
}

/**
 * Derive Claudius presence from ~/.claude/sessions/*.json
 * Each file is named {PID}.json. If the PID is alive and the file was
 * recently modified, Claude Code is actively coding.
 */
function deriveClaudiusPresence(): PresenceInfo {
  if (!existsSync(CLAUDE_SESSIONS_DIR)) {
    return { state: "idle", detail: "No Claude Code sessions", sessionKey: null, updatedAt: null };
  }

  try {
    const files = readdirSync(CLAUDE_SESSIONS_DIR).filter((f) => f.endsWith(".json"));
    let newestAlive: { pid: number; mtime: number; cwd: string } | null = null;

    for (const file of files) {
      const pid = parseInt(basename(file, ".json"), 10);
      if (isNaN(pid) || !isPidAlive(pid)) continue;

      const filePath = join(CLAUDE_SESSIONS_DIR, file);
      const mtime = statSync(filePath).mtimeMs;

      // Read cwd for detail text
      let cwd = "";
      try {
        const data = JSON.parse(readFileSync(filePath, "utf-8")) as ClaudeSessionFile;
        cwd = data.cwd ?? "";
      } catch { /* ignore parse errors */ }

      if (!newestAlive || mtime > newestAlive.mtime) {
        newestAlive = { pid, mtime, cwd };
      }
    }

    if (newestAlive) {
      const ageMs = Date.now() - newestAlive.mtime;
      const projectName = newestAlive.cwd.split("/").pop() ?? "unknown";

      if (ageMs < 30_000) {
        return {
          state: "thinking",
          detail: `Coding in ${projectName}`,
          sessionKey: `pid:${newestAlive.pid}`,
          updatedAt: newestAlive.mtime,
        };
      }
      if (ageMs < 120_000) {
        return {
          state: "busy",
          detail: `Active session in ${projectName}`,
          sessionKey: `pid:${newestAlive.pid}`,
          updatedAt: newestAlive.mtime,
        };
      }
      // Alive but stale — idle
      return {
        state: "idle",
        detail: `Session open in ${projectName}`,
        sessionKey: `pid:${newestAlive.pid}`,
        updatedAt: newestAlive.mtime,
      };
    }

    return { state: "idle", detail: "No active sessions", sessionKey: null, updatedAt: null };
  } catch {
    return { state: "idle", detail: "Error reading Claude sessions", sessionKey: null, updatedAt: null };
  }
}

export async function GET() {
  const result: Record<string, PresenceInfo> = {};

  for (const agent of AGENTS) {
    result[agent.name] = derivePresence(agent.path, agent.name === "jarvis" ? "Jarvis" : "Cody");
  }

  result.claudius = deriveClaudiusPresence();

  return NextResponse.json(result, {
    status: 200,
    headers: {
      "Cache-Control": "no-store, no-cache, must-revalidate",
    },
  });
}

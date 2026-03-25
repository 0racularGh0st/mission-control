/**
 * Background session monitor — parses `openclaw sessions` text output
 * and logs active agents to the activity log.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { logActivity, updateActivityStatus, readActivitiesFromFile } from "@/src/server/agentActivityLog";
import { readFileSync } from "fs";
import { join } from "path";

const execFileAsync = promisify(execFile);

interface SessionStats {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  ageMs: number;
  model: string;
  modelProvider: string;
  totalTokensFresh: boolean;
}

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  "MiniMax-M2.7": { input: 0.3, output: 1.2 },
  "minimax/MiniMax-M2.7": { input: 0.3, output: 1.2 },
  "mini": { input: 0.1, output: 0.4 },
  "minimax/mini": { input: 0.1, output: 0.4 },
  "gpt-5.4-mini": { input: 0.15, output: 0.6 },
  "gpt-5.3-codex": { input: 0.15, output: 0.6 },
  "gpt-5-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-5.4-mini": { input: 0.15, output: 0.6 },
  "openai/gpt-5.3-codex": { input: 0.15, output: 0.6 },
  "openai/gpt-5-mini": { input: 0.15, output: 0.6 },
};

function getDefaultPricing() {
  return { input: 0.3, output: 1.2 };
}

function estimateCost(tokensIn: number, tokensOut: number, model: string): number {
  const key = model in PRICING ? model : Object.keys(PRICING).find((k) => model.includes(k)) ?? "";
  const { input, output } = key && PRICING[key] ? PRICING[key] : getDefaultPricing();
  return (tokensIn * input + tokensOut * output) / 1_000_000;
}

/**
 * Read sessions directly from the sessions JSON file (same data `openclaw sessions` uses).
 */
function getSessionStatsFromFile(): Map<string, SessionStats> {
  const stats = new Map<string, SessionStats>();
  try {
    const sessionsPath = join(process.cwd(), ".runtime", "..", "agents", "main", "sessions", "sessions.json");
    const content = readFileSync(sessionsPath, "utf-8");
    const data = JSON.parse(content);
    for (const s of data.sessions ?? []) {
      stats.set(s.sessionId, {
        inputTokens: s.inputTokens ?? 0,
        outputTokens: s.outputTokens ?? 0,
        totalTokens: s.totalTokens ?? 0,
        ageMs: s.ageMs ?? 0,
        model: s.model ?? "unknown",
        modelProvider: s.modelProvider ?? "unknown",
        totalTokensFresh: s.totalTokensFresh ?? false,
      });
    }
  } catch {
    // fallback: try via openclaw sessions --json
  }
  return stats;
}

const POLL_INTERVAL_MS = 30_000;
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastPollTime = 0;
let idCounter = Date.now();

interface ParsedSession {
  sessionKey: string;
  sessionId: string; // the id: field from flags
  agentType: "jarvis" | "cody" | "sandra" | "subagent";
  model: string;
  age: string;
  tokens: string;
}

function parseOpenclawSessions(stdout: string): ParsedSession[] {
  const lines = stdout.split("\n").filter((l) => l.trim() && !l.startsWith("Session store") && !l.startsWith("Sessions listed") && !l.startsWith("Kind"));
  const sessions: ParsedSession[] = [];

  for (const line of lines) {
    // Text format: direct agent:main:teleg...751104  2m ago    MiniMax-M2.7   118k/205k (58%)      system id:0ee27d5f-c192-43ba-92e8-5b7340f5a621
    const idMatch = line.match(/id:(\S+)/);
    const id = idMatch ? idMatch[1] : "";
    const parts = line.trim().split(/\s+/);
    if (parts.length < 4) continue;

    const key = parts[1] ?? "";
    const age = parts[2] ?? "";
    const model = parts[3] ?? "";

    // Determine agent type from session key
    let agentType: ParsedSession["agentType"] = "subagent";
    if (key.includes("cody")) agentType = "cody";
    else if (key.includes("sandra")) agentType = "sandra";
    else if (key.includes("jarvis") || key.includes("teleg")) agentType = "jarvis";

    if (id) {
      sessions.push({ sessionKey: id, sessionId: id, agentType, model, age, tokens: "" });
    }
  }

  return sessions;
}

function hasRecentRunningEntry(sessionKey: string, sinceMs: number): boolean {
  const activities = readActivitiesFromFile(200);
  return activities.some(
    (a) =>
      a.sessionKey === sessionKey &&
      a.status === "running" &&
      Date.now() - new Date(a.startedAt).getTime() < sinceMs,
  );
}

export async function ensureJarvisLogged(): Promise<void> {
  try {
    const { stdout } = await execFileAsync("openclaw", ["sessions"], { timeout: 5000 });
    const sessions = parseOpenclawSessions(stdout);
    const jarvisSession = sessions.find((s) => s.agentType === "jarvis");

    if (jarvisSession && !hasRecentRunningEntry(jarvisSession.sessionKey, 60 * 60 * 1000)) {
      logActivity({
        id: `jarvis-${idCounter++}`,
        sessionKey: jarvisSession.sessionKey,
        agentType: "jarvis",
        model: jarvisSession.model || "MiniMax-M2.7",
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        durationMs: 0,
        tokensIn: 0,
        tokensOut: 0,
        taskDescription: "Jarvis session started",
        status: "running",
        resultSummary: "Active",
        estimatedCostUsd: 0,
      });
    }
  } catch {
    // silent
  }
}

/**
 * Log a subagent dispatch with its real task description.
 * Call this when spawning a subagent so the log has meaningful descriptions.
 */
export function logSubagentDispatch(sessionKey: string, taskDescription: string, model = "MiniMax-M2.7"): void {
  logActivity({
    id: `subagent-${idCounter++}`,
    sessionKey,
    agentType: "subagent",
    model,
    startedAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
    durationMs: 0,
    tokensIn: 0,
    tokensOut: 0,
    taskDescription,
    status: "running",
    resultSummary: "Active",
    estimatedCostUsd: 0,
  });
}

export async function pollAndLogActiveSessions(): Promise<void> {
  if (Date.now() - lastPollTime < POLL_INTERVAL_MS) return;
  lastPollTime = Date.now();

  try {
    const { stdout } = await execFileAsync("openclaw", ["sessions"], { timeout: 5000 });
    const sessions = parseOpenclawSessions(stdout);
    const currentKeys = new Set(sessions.map((s) => s.sessionKey));

    // Get fresh stats from sessions JSON file for cost/duration calculation
    const allSessionStats = getSessionStatsFromFile();

    // Only detect completions for subagents — spawns are logged via logSubagentDispatch()
    const activities = readActivitiesFromFile(200);
    for (const activity of activities) {
      if (activity.status !== "running" || activity.agentType === "jarvis") continue;
      if (!currentKeys.has(activity.sessionKey)) {
        // Look up stats from the sessions file for this session
        const stats = allSessionStats.get(activity.sessionKey);
        const durationMs = stats?.ageMs ?? Date.now() - new Date(activity.startedAt).getTime();
        const tokensIn = stats?.inputTokens ?? 0;
        const tokensOut = stats?.outputTokens ?? 0;
        const model = stats?.model ?? activity.model;
        const estimatedCostUsd = estimateCost(tokensIn, tokensOut, model);

        updateActivityStatus(activity.sessionKey, {
          status: "completed",
          completedAt: new Date().toISOString(),
          durationMs,
          tokensIn,
          tokensOut,
          estimatedCostUsd,
          resultSummary: activity.resultSummary !== "Active" ? activity.resultSummary : "Completed",
        });
      }
    }
  } catch {
    // silent
  }
}

/**
 * Backfill completed entries in the activity log that have durationMs=0.
 * Tries to look up stats from sessions.json; falls back to computing
 * duration from startedAt/completedAt timestamps.
 */
export async function backfillCompletedEntries(): Promise<void> {
  try {
    const { readFileSync, writeFileSync, existsSync } = await import("fs");
    const { join } = await import("path");
    const logFile = join(process.cwd(), ".runtime", "agent-activity.log");
    if (!existsSync(logFile)) return;

    const content = readFileSync(logFile, "utf-8");
    const lines = content.split("\n").filter(Boolean);
    const allSessionStats = getSessionStatsFromFile();
    let changed = false;

    const updatedLines = lines.map((line) => {
      try {
        const entry = JSON.parse(line) as { status?: string; durationMs?: number; sessionKey?: string; startedAt?: string; completedAt?: string; tokensIn?: number; tokensOut?: number; model?: string; estimatedCostUsd?: number };
        if (entry.status !== "completed" || entry.durationMs !== 0) return line;

        const stats = entry.sessionKey ? allSessionStats.get(entry.sessionKey) : undefined;
        const hasTokensFromSession = stats && (stats.inputTokens > 0 || stats.outputTokens > 0);

        if (!hasTokensFromSession && entry.startedAt && entry.completedAt) {
          // No session data — compute duration from timestamps
          const durationMs = new Date(entry.completedAt).getTime() - new Date(entry.startedAt).getTime();
          entry.durationMs = Math.max(0, durationMs);
        } else if (stats) {
          entry.durationMs = entry.durationMs === 0 ? (stats.ageMs || 0) : entry.durationMs;
        }

        if (hasTokensFromSession && stats) {
          entry.tokensIn = stats.inputTokens;
          entry.tokensOut = stats.outputTokens;
          entry.estimatedCostUsd = estimateCost(stats.inputTokens, stats.outputTokens, entry.model ?? "");
        }

        changed = true;
        return JSON.stringify(entry);
      } catch {
        return line;
      }
    });

    if (changed) {
      writeFileSync(logFile, updatedLines.join("\n") + "\n", "utf-8");
      // Also reload ring buffer in agentActivityLog — but we can't call init() from here cleanly.
      // The next poll will reload. For immediate effect, also clear ring buffer sentinel.
      try {
        const { resetRingBuffer } = await import("@/src/server/agentActivityLog");
        resetRingBuffer?.();
      } catch {
        // agentActivityLog may not export resetRingBuffer — that's fine
      }
    }
  } catch {
    // silent
  }
}

export function startSessionMonitor(): void {
  if (monitorInterval) return;
  void ensureJarvisLogged();
  void pollAndLogActiveSessions();
  void backfillCompletedEntries();
  monitorInterval = setInterval(() => {
    void ensureJarvisLogged();
    void pollAndLogActiveSessions();
  }, POLL_INTERVAL_MS);
}

export function stopSessionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

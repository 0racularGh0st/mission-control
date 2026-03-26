/**
 * Session monitor — reads OpenClaw sessions.json files directly
 * to track Jarvis (main agent) and Cody (coding agent) activity.
 */

import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { logActivity, updateActivityStatus, readActivitiesFromFile } from "@/src/server/agentActivityLog";
import type { AgentActivityEntry } from "@/src/types/agentActivity";

// Absolute paths to agent session stores
const OPENCLAW_DIR = join(process.env.HOME ?? "/Users/nigel", ".openclaw");
const AGENT_SESSIONS: { agent: AgentActivityEntry["agentType"]; name: string; path: string }[] = [
  {
    agent: "jarvis",
    name: "Jarvis",
    path: join(OPENCLAW_DIR, "agents", "main", "sessions", "sessions.json"),
  },
  {
    agent: "cody",
    name: "Cody",
    path: join(OPENCLAW_DIR, "agents", "cody", "sessions", "sessions.json"),
  },
];

// Pricing per 1M tokens
const PRICING: Record<string, { input: number; output: number }> = {
  "MiniMax-M2.7": { input: 0.3, output: 1.2 },
  "gpt-5.4-mini": { input: 0.15, output: 0.6 },
  "gpt-5.3-codex": { input: 0.15, output: 0.6 },
  "gpt-5-mini": { input: 0.15, output: 0.6 },
};

function estimateCost(tokensIn: number, tokensOut: number, model: string): number {
  const key = Object.keys(PRICING).find((k) => model.includes(k));
  const { input, output } = key ? PRICING[key] : { input: 0.3, output: 1.2 };
  return (tokensIn * input + tokensOut * output) / 1_000_000;
}

interface SessionRecord {
  sessionId: string;
  model?: string;
  modelProvider?: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  runtimeMs?: number;
  startedAt?: number;
  endedAt?: number;
  updatedAt?: number;
  status?: string;
  label?: string;
  chatType?: string;
  origin?: { provider?: string; label?: string };
}

function classifyAgentType(
  sessionKey: string,
  defaultAgent: AgentActivityEntry["agentType"],
): AgentActivityEntry["agentType"] {
  if (sessionKey.startsWith("agent:cody:")) return "cody";
  if (sessionKey.includes(":subagent:")) return "subagent";
  return defaultAgent;
}

function describeSession(sessionKey: string, record: SessionRecord, agentName: string): string {
  if (record.label) return record.label;
  if (sessionKey.includes(":telegram:")) return `${agentName} — Telegram conversation`;
  if (sessionKey.includes(":cron:")) return `${agentName} — Cron job`;
  if (sessionKey.includes(":subagent:")) return `${agentName} subagent task`;
  if (sessionKey.endsWith(":main")) return `${agentName} — Heartbeat`;
  return `${agentName} session`;
}

function sessionStatus(record: SessionRecord): AgentActivityEntry["status"] {
  if (record.status === "done" || record.endedAt) return "completed";
  if (record.status === "error" || record.status === "failed") return "failed";
  return "running";
}

/**
 * Read all sessions from an agent's sessions.json file.
 * Deduplicates by sessionId (cron run keys duplicate the parent cron key).
 */
function readSessionsFile(path: string): Map<string, { key: string; record: SessionRecord }> {
  const sessions = new Map<string, { key: string; record: SessionRecord }>();
  if (!existsSync(path)) return sessions;

  try {
    const content = readFileSync(path, "utf-8");
    const data = JSON.parse(content) as Record<string, SessionRecord>;

    for (const [key, record] of Object.entries(data)) {
      if (!record.sessionId) continue;
      // Skip :run: duplicates — they mirror the parent cron session
      if (key.includes(":run:")) continue;

      const existing = sessions.get(record.sessionId);
      if (!existing || (record.updatedAt ?? 0) > (existing.record.updatedAt ?? 0)) {
        sessions.set(record.sessionId, { key, record });
      }
    }
  } catch {
    // silently ignore read errors
  }

  return sessions;
}

const POLL_INTERVAL_MS = 15_000;
let monitorInterval: ReturnType<typeof setInterval> | null = null;
const knownSessionIds = new Set<string>();

/**
 * Scan all agent session files and sync activity log.
 * - New sessions get logged as running or completed
 * - Previously-running sessions that completed get updated
 */
export async function pollAndLogActiveSessions(): Promise<void> {
  const existingActivities = readActivitiesFromFile(500);
  const existingBySession = new Map<string, AgentActivityEntry>();
  for (const a of existingActivities) {
    // Keep the most recent entry per sessionId
    if (!existingBySession.has(a.sessionKey)) {
      existingBySession.set(a.sessionKey, a);
    }
  }

  for (const agentDef of AGENT_SESSIONS) {
    const sessions = readSessionsFile(agentDef.path);

    for (const [sessionId, { key, record }] of sessions) {
      const agentType = classifyAgentType(key, agentDef.agent);
      const status = sessionStatus(record);
      const model = record.model ?? "unknown";
      const tokensIn = record.inputTokens ?? 0;
      const tokensOut = record.outputTokens ?? 0;
      const cost = record.estimatedCostUsd ?? estimateCost(tokensIn, tokensOut, model);
      const durationMs = record.runtimeMs ?? 0;
      const startedAt = record.startedAt
        ? new Date(record.startedAt).toISOString()
        : new Date(record.updatedAt ?? Date.now()).toISOString();
      const completedAt = record.endedAt
        ? new Date(record.endedAt).toISOString()
        : status === "completed"
          ? new Date(record.updatedAt ?? Date.now()).toISOString()
          : startedAt;

      const existing = existingBySession.get(sessionId);

      if (!existing) {
        // New session — log it
        logActivity({
          id: `${agentType}-${sessionId.slice(0, 8)}`,
          sessionKey: sessionId,
          agentType,
          model,
          startedAt,
          completedAt,
          durationMs,
          tokensIn,
          tokensOut,
          taskDescription: describeSession(key, record, agentDef.name),
          status,
          resultSummary: status === "completed" ? "Completed" : status === "failed" ? "Failed" : "Active",
          estimatedCostUsd: cost,
        });
        knownSessionIds.add(sessionId);
      } else if (existing.status === "running" && status !== "running") {
        // Session completed — update it
        updateActivityStatus(sessionId, {
          status,
          completedAt,
          durationMs,
          tokensIn,
          tokensOut,
          estimatedCostUsd: cost,
          resultSummary: status === "completed" ? "Completed" : "Failed",
        });
      }
    }
  }
}

/**
 * Ensure Jarvis has a running entry if any direct/telegram session is active.
 */
export async function ensureJarvisLogged(): Promise<void> {
  // Handled by pollAndLogActiveSessions — Jarvis sessions appear in main sessions.json
}

/**
 * Log a subagent dispatch with its real task description.
 */
export function logSubagentDispatch(sessionKey: string, taskDescription: string, model = "MiniMax-M2.7"): void {
  logActivity({
    id: `subagent-${Date.now()}`,
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

export async function backfillCompletedEntries(): Promise<void> {
  // No longer needed — pollAndLogActiveSessions reads real data from sessions.json
}

export function startSessionMonitor(): void {
  if (monitorInterval) return;
  // Initial poll
  void pollAndLogActiveSessions();
  // Continue polling
  monitorInterval = setInterval(() => {
    void pollAndLogActiveSessions();
  }, POLL_INTERVAL_MS);
}

export function stopSessionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

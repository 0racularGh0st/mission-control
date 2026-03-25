/**
 * Background session monitor — parses `openclaw sessions` text output
 * and logs active agents to the activity log.
 */

import { execFile } from "child_process";
import { promisify } from "util";
import { logActivity, updateActivityStatus, readActivitiesFromFile } from "@/src/server/agentActivityLog";

const execFileAsync = promisify(execFile);

const POLL_INTERVAL_MS = 30_000;
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastPollTime = 0;

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

    const kind = parts[0];
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
        id: `jarvis-${Date.now()}`,
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

export async function pollAndLogActiveSessions(): Promise<void> {
  if (Date.now() - lastPollTime < POLL_INTERVAL_MS) return;
  lastPollTime = Date.now();

  try {
    const { stdout } = await execFileAsync("openclaw", ["sessions"], { timeout: 5000 });
    const sessions = parseOpenclawSessions(stdout);
    const currentKeys = new Set(sessions.map((s) => s.sessionKey));

    // Log new sessions that aren't tracked yet
    for (const session of sessions) {
      if (session.agentType === "jarvis") continue;

      if (!hasRecentRunningEntry(session.sessionKey, POLL_INTERVAL_MS * 2)) {
        logActivity({
          id: `${session.agentType}-${Date.now()}`,
          sessionKey: session.sessionKey,
          agentType: session.agentType,
          model: session.model || "MiniMax-M2.7",
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          durationMs: 0,
          tokensIn: 0,
          tokensOut: 0,
          taskDescription: `${session.agentType} session active`,
          status: "running",
          resultSummary: "Active",
          estimatedCostUsd: 0,
        });
      }
    }

    // Detect completions: running sessions that are no longer in the list
    const activities = readActivitiesFromFile(200);
    for (const activity of activities) {
      if (activity.status !== "running" || activity.agentType === "jarvis") continue;
      if (!currentKeys.has(activity.sessionKey)) {
        updateActivityStatus(activity.sessionKey, {
          status: "completed",
          completedAt: new Date().toISOString(),
          resultSummary: "Completed",
        });
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

/**
 * Background session monitor — polls OpenClaw for active sessions and logs
 * agent activity automatically.
 *
 * Runs on the server side, called from the activity API route on GET.
 */

import { logActivity, updateActivityStatus, readActivitiesFromFile } from "@/src/server/agentActivityLog";

const POLL_INTERVAL_MS = 30_000; // 30 seconds
let monitorInterval: ReturnType<typeof setInterval> | null = null;
let lastPollTime = 0;

interface ActiveSession {
  sessionKey: string;
  agentType: "jarvis" | "cody" | "sandra" | "subagent";
  model: string;
  startedAt: string;
}

/**
 * Returns the list of sessions known to OpenClaw that are currently active.
 * Returns empty array if unavailable — always fails silently.
 */
async function getOpenClawSessions(): Promise<ActiveSession[]> {
  try {
    // Dynamic import to avoid top-level import issues
    const { execFile } = await import("child_process");
    const { promisify } = await import("util");
    const execFileAsync = promisify(execFile);

    // Run: openclaw sessions list --json
    const { stdout } = await execFileAsync("openclaw", ["sessions", "list", "--json"], {
      timeout: 5000,
    });

    const output = stdout.toString().trim();
    if (!output) return [];

    const sessions = JSON.parse(output) as Array<{
      sessionKey: string;
      agentId?: string;
      model?: string;
      startedAt?: string;
    }>;

    return sessions.map((s) => ({
      sessionKey: s.sessionKey,
      agentType: s.agentId?.includes("cody")
        ? "cody"
        : s.agentId?.includes("sandra")
          ? "sandra"
          : s.agentId?.includes("jarvis") || !s.agentId
            ? "jarvis"
            : "subagent",
      model: s.model ?? "unknown",
      startedAt: s.startedAt ?? new Date().toISOString(),
    }));
  } catch {
    return [];
  }
}

/** Check if we already logged a "running" entry for this sessionKey recently */
function hasRecentRunningEntry(sessionKey: string, sinceMs: number): boolean {
  const activities = readActivitiesFromFile(200);
  return activities.some(
    (a) =>
      a.sessionKey === sessionKey &&
      a.status === "running" &&
      Date.now() - new Date(a.startedAt).getTime() < sinceMs,
  );
}

/** Log a Jarvis session start if not already logged */
export async function ensureJarvisLogged(): Promise<void> {
  try {
    const sessions = await getOpenClawSessions();
    const jarvisSession = sessions.find((s) => s.agentType === "jarvis");

    if (jarvisSession && !hasRecentRunningEntry(jarvisSession.sessionKey, 60 * 60 * 1000)) {
      logActivity({
        id: `jarvis-${Date.now()}`,
        sessionKey: jarvisSession.sessionKey,
        agentType: "jarvis",
        model: jarvisSession.model,
        startedAt: jarvisSession.startedAt,
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
    // silent — never fail
  }
}

// Track sessions seen in last poll — used to detect completions
let previousSessionKeys = new Set<string>();

/** Poll for active sessions and log any that aren't logged yet */
export async function pollAndLogActiveSessions(): Promise<void> {
  if (Date.now() - lastPollTime < POLL_INTERVAL_MS) return;
  lastPollTime = Date.now();

  try {
    const sessions = await getOpenClawSessions();

    for (const session of sessions) {
      // Skip Jarvis (handled separately by ensureJarvisLogged)
      if (session.agentType === "jarvis") continue;

      // Log new subagent/cody sessions that aren't tracked yet
      if (!hasRecentRunningEntry(session.sessionKey, POLL_INTERVAL_MS * 2)) {
        logActivity({
          id: `${session.agentType}-${Date.now()}`,
          sessionKey: session.sessionKey,
          agentType: session.agentType,
          model: session.model,
          startedAt: session.startedAt,
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

    // Detect completions: sessions that were running but are no longer active
    const currentKeys = new Set(sessions.map((s) => s.sessionKey));
    for (const prevKey of previousSessionKeys) {
      if (!currentKeys.has(prevKey)) {
        // Session disappeared — mark as completed
        const activities = readActivitiesFromFile(200);
        const running = activities.find(
          (a) => a.sessionKey === prevKey && a.status === "running",
        );
        if (running) {
          updateActivityStatus(prevKey, {
            status: "completed",
            completedAt: new Date().toISOString(),
            resultSummary: "Completed",
          });
        }
      }
    }

    previousSessionKeys = currentKeys;
  } catch {
    // silent
  }
}

/** Start the background monitor */
export function startSessionMonitor(): void {
  if (monitorInterval) return;

  // Run immediately on start
  void ensureJarvisLogged();
  void pollAndLogActiveSessions();

  monitorInterval = setInterval(() => {
    void ensureJarvisLogged();
    void pollAndLogActiveSessions();
  }, POLL_INTERVAL_MS);
}

/** Stop the background monitor */
export function stopSessionMonitor(): void {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
}

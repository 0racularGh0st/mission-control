import { getDb } from "@/src/server/db";
import { getTasks } from "@/src/runtime/tasks/store";
import type {
  ActiveAgentDto,
  AgentHealth,
  DashboardRuntimeStateDto,
  DashboardSnapshotDto,
  ModelRoutingEntryDto,
  RuntimeAlertDto,
  RuntimeLogEntryDto,
  TaskQueueLaneDto,
  TokenCostSummaryDto,
} from "./types";

/* ------------------------------------------------------------------ */
/*  DB query helpers                                                   */
/* ------------------------------------------------------------------ */

interface AgentRow {
  agent_type: string;
  model: string;
  status: string;
  cnt: number;
  total_in: number;
  total_out: number;
  total_cost: number;
  median_latency: number;
}

interface SessionCostRow {
  total_in: number;
  total_out: number;
  total_cost: number;
}

interface ModelShareRow {
  model: string;
  cnt: number;
}

interface ActivityLogRow {
  id: string;
  agent_type: string;
  model: string;
  task_desc: string;
  status: string;
  started_at: string;
  completed_at: string | null;
}

interface RunningAgentRow {
  agent_type: string;
  model: string;
  started_at: string;
  task_desc: string;
}

const AGENT_DISPLAY: Record<string, { name: string; role: string }> = {
  jarvis: { name: "Jarvis", role: "Primary Assistant" },
  cody: { name: "Cody", role: "Code Agent" },
  sandra: { name: "Sandra", role: "Research Agent" },
  subagent: { name: "Subagent Pool", role: "Delegated tasks" },
};

/* ------------------------------------------------------------------ */
/*  Build active agents from agent_activity                            */
/* ------------------------------------------------------------------ */

function buildAgents(): ActiveAgentDto[] {
  const db = getDb();

  // Get distinct agent types with their most recent model, plus running counts
  const rows = db.prepare(`
    SELECT
      agent_type,
      model,
      SUM(CASE WHEN status = 'running' THEN 1 ELSE 0 END) as queue_depth,
      COALESCE(AVG(CASE WHEN status = 'completed' THEN duration_ms END), 0) as avg_latency,
      MAX(started_at) as last_seen
    FROM agent_activity
    GROUP BY agent_type, model
    HAVING model != 'unknown'
    ORDER BY last_seen DESC
  `).all() as Array<{
    agent_type: string;
    model: string;
    queue_depth: number;
    avg_latency: number;
    last_seen: string;
  }>;

  // Deduplicate by agent_type, picking the most recent model
  const seen = new Set<string>();
  const agents: ActiveAgentDto[] = [];

  for (const row of rows) {
    if (seen.has(row.agent_type)) continue;
    seen.add(row.agent_type);

    const display = AGENT_DISPLAY[row.agent_type] ?? {
      name: row.agent_type,
      role: "Agent",
    };

    // Health: running agents with old started_at = degraded, running = busy, else healthy
    let health: AgentHealth = "healthy";
    if (row.queue_depth > 0) {
      const runningAgents = db.prepare(`
        SELECT started_at FROM agent_activity
        WHERE agent_type = ? AND status = 'running'
        ORDER BY started_at ASC LIMIT 1
      `).get(row.agent_type) as RunningAgentRow | undefined;

      if (runningAgents) {
        const ageMs = Date.now() - new Date(runningAgents.started_at).getTime();
        const oneHour = 60 * 60 * 1000;
        health = ageMs > oneHour ? "degraded" : "busy";
      }
    }

    agents.push({
      id: `agent-${row.agent_type}`,
      name: display.name,
      role: display.role,
      health,
      model: row.model,
      queueDepth: row.queue_depth,
      medianLatencyMs: Math.round(row.avg_latency),
    });
  }

  return agents;
}

/* ------------------------------------------------------------------ */
/*  Build token/cost summary from both tables (today only)             */
/* ------------------------------------------------------------------ */

function buildTokenCost(): TokenCostSummaryDto {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Sum from claude_sessions today
  const sessions = db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens), 0)  as total_in,
      COALESCE(SUM(output_tokens), 0) as total_out,
      COALESCE(SUM(cost_usd), 0)      as total_cost
    FROM claude_sessions
    WHERE date(started_at) = ?
  `).get(today) as SessionCostRow;

  // Sum from agent_activity today
  const activity = db.prepare(`
    SELECT
      COALESCE(SUM(tokens_in), 0)  as total_in,
      COALESCE(SUM(tokens_out), 0) as total_out,
      COALESCE(SUM(cost_usd), 0)   as total_cost
    FROM agent_activity
    WHERE date(started_at) = ?
  `).get(today) as SessionCostRow;

  const inputTokens = sessions.total_in + activity.total_in;
  const outputTokens = sessions.total_out + activity.total_out;
  const totalCostUsd = sessions.total_cost + activity.total_cost;

  // Yesterday for delta calculation
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const yesterdaySessions = db.prepare(`
    SELECT
      COALESCE(SUM(input_tokens), 0)  as total_in,
      COALESCE(SUM(output_tokens), 0) as total_out,
      COALESCE(SUM(cost_usd), 0)      as total_cost
    FROM claude_sessions
    WHERE date(started_at) = ?
  `).get(yesterday) as SessionCostRow;
  const yesterdayActivity = db.prepare(`
    SELECT
      COALESCE(SUM(tokens_in), 0)  as total_in,
      COALESCE(SUM(tokens_out), 0) as total_out,
      COALESCE(SUM(cost_usd), 0)   as total_cost
    FROM agent_activity
    WHERE date(started_at) = ?
  `).get(yesterday) as SessionCostRow;

  const prevIn = yesterdaySessions.total_in + yesterdayActivity.total_in;
  const prevOut = yesterdaySessions.total_out + yesterdayActivity.total_out;
  const prevCost = yesterdaySessions.total_cost + yesterdayActivity.total_cost;

  const inputDeltaPct = prevIn > 0 ? Math.round(((inputTokens - prevIn) / prevIn) * 1000) / 10 : 0;
  const outputDeltaPct = prevOut > 0 ? Math.round(((outputTokens - prevOut) / prevOut) * 1000) / 10 : 0;
  const costDeltaUsd = Math.round((totalCostUsd - prevCost) * 100) / 100;

  // Project day-end: scale by fraction of day elapsed
  const now = new Date();
  const hoursPassed = now.getHours() + now.getMinutes() / 60;
  const dayFraction = Math.max(hoursPassed / 24, 0.01);
  const projectedDayEndUsd = Math.round((totalCostUsd / dayFraction) * 100) / 100;

  return {
    inputTokens,
    outputTokens,
    totalCostUsd: Math.round(totalCostUsd * 100) / 100,
    projectedDayEndUsd,
    inputDeltaPct,
    outputDeltaPct,
    costDeltaUsd,
    withinBudget: totalCostUsd < 200, // soft cap
  };
}

/* ------------------------------------------------------------------ */
/*  Build model routing from actual usage across both tables           */
/* ------------------------------------------------------------------ */

function buildModelRouting(): ModelRoutingEntryDto[] {
  const db = getDb();

  // Combine model usage from sessions and activity (last 7 days)
  const cutoff = new Date(Date.now() - 7 * 86400000).toISOString();

  const sessionModels = db.prepare(`
    SELECT model, COUNT(*) as cnt
    FROM claude_sessions
    WHERE started_at > ? AND model != 'unknown'
    GROUP BY model
  `).all(cutoff) as ModelShareRow[];

  const activityModels = db.prepare(`
    SELECT model, COUNT(*) as cnt
    FROM agent_activity
    WHERE started_at > ? AND model != 'unknown'
    GROUP BY model
  `).all(cutoff) as ModelShareRow[];

  // Merge counts
  const modelCounts = new Map<string, number>();
  for (const row of [...sessionModels, ...activityModels]) {
    modelCounts.set(row.model, (modelCounts.get(row.model) ?? 0) + row.cnt);
  }

  const total = Array.from(modelCounts.values()).reduce((a, b) => a + b, 0);
  if (total === 0) return [];

  // Assign roles based on known models
  const roleMap: Record<string, string> = {
    "claude-opus-4-6": "Deep reasoning",
    "claude-sonnet-4-6": "Fast coding",
    "MiniMax-M2.7": "Jarvis primary",
    "gpt-5.3-codex": "Coding tasks",
    "gpt-5.4-mini": "Lightweight ops",
    "gpt-5-mini": "Quick lookups",
  };

  return Array.from(modelCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([model, cnt]) => ({
      model,
      sharePct: Math.round((cnt / total) * 100),
      role: roleMap[model] ?? "General",
    }));
}

/* ------------------------------------------------------------------ */
/*  Build recent logs from agent_activity                              */
/* ------------------------------------------------------------------ */

function buildRecentLogs(count = 20): RuntimeLogEntryDto[] {
  const db = getDb();

  const rows = db.prepare(`
    SELECT id, agent_type, model, task_desc, status, started_at, completed_at
    FROM agent_activity
    ORDER BY started_at DESC
    LIMIT ?
  `).all(count) as ActivityLogRow[];

  return rows.map((row) => {
    const time = new Date(row.completed_at ?? row.started_at)
      .toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
    const agentName = AGENT_DISPLAY[row.agent_type]?.name ?? row.agent_type;
    const statusEmoji = row.status === "running" ? "⟳" : row.status === "completed" ? "✓" : "✗";

    return {
      id: row.id,
      message: `${time} ${agentName} [${row.model}]: ${statusEmoji} ${row.task_desc}`,
      createdAtIso: row.completed_at ?? row.started_at,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Build alerts from stuck running agents + blocked tasks             */
/* ------------------------------------------------------------------ */

function buildAlerts(): RuntimeAlertDto[] {
  const db = getDb();
  const alerts: RuntimeAlertDto[] = [];

  // Stuck running agents (running > 1 hour)
  const stuckAgents = db.prepare(`
    SELECT id, agent_type, task_desc, started_at
    FROM agent_activity
    WHERE status = 'running'
      AND datetime(started_at) < datetime('now', '-1 hour')
    ORDER BY started_at ASC
  `).all() as Array<{ id: string; agent_type: string; task_desc: string; started_at: string }>;

  for (const agent of stuckAgents) {
    const staleMinutes = Math.floor((Date.now() - new Date(agent.started_at).getTime()) / 60000);
    const name = AGENT_DISPLAY[agent.agent_type]?.name ?? agent.agent_type;
    alerts.push({
      id: `alert-stuck-${agent.id}`,
      title: `Stuck: ${name}`,
      detail: `${agent.task_desc} — no completion for ${staleMinutes}m`,
      severity: staleMinutes > 360 ? "critical" : "warning",
      staleForMinutes: staleMinutes,
    });
  }

  // Blocked tasks
  const tasks = getTasks();
  const blockedTasks = tasks.filter((t) => t.lane === "blocked");
  for (const task of blockedTasks) {
    const staleMinutes = Math.floor((Date.now() - new Date(task.updatedAt).getTime()) / 60000);
    alerts.push({
      id: `alert-${task.id}`,
      title: `Blocked: ${task.title}`,
      detail: task.blockingReason ?? "No details provided",
      severity: task.priority === "P0" ? "critical" : "warning",
      stuckTaskId: task.id,
      staleForMinutes: staleMinutes,
    });
  }

  return alerts;
}

/* ------------------------------------------------------------------ */
/*  Build queue snapshot from tasks table                              */
/* ------------------------------------------------------------------ */

function buildQueueSnapshot(): TaskQueueLaneDto[] {
  const tasks = getTasks();

  const laneLabels: Record<string, { label: string; stateLabel: string }> = {
    now: { label: "Now", stateLabel: "In progress" },
    next: { label: "Next", stateLabel: "Queued" },
    review: { label: "Review", stateLabel: "Pending approval" },
    blocked: { label: "Blocked", stateLabel: "Needs input" },
  };

  return (["now", "next", "review", "blocked"] as const).map((lane) => {
    const laneTasks = tasks.filter((t) => t.lane === lane);
    // Average ETA from tasks that have one
    const withEta = laneTasks.filter((t) => t.etaMinutes != null);
    const avgEta = withEta.length > 0
      ? Math.round(withEta.reduce((sum, t) => sum + (t.etaMinutes ?? 0), 0) / withEta.length)
      : null;

    return {
      lane,
      label: laneLabels[lane]?.label ?? lane,
      stateLabel: laneLabels[lane]?.stateLabel ?? "",
      count: laneTasks.length,
      etaMinutes: avgEta,
    };
  });
}

/* ------------------------------------------------------------------ */
/*  Public adapter                                                     */
/* ------------------------------------------------------------------ */

function createCursor() {
  return `ts_${Date.now()}`;
}

export class RealDashboardAdapter {
  async getSnapshot(): Promise<DashboardSnapshotDto> {
    return {
      generatedAtIso: new Date().toISOString(),
      source: "local-api",
      activeAgents: buildAgents(),
      queueSnapshot: buildQueueSnapshot(),
      alerts: buildAlerts(),
      tokenCostSummary: buildTokenCost(),
      modelRouting: buildModelRouting(),
      recentLogs: buildRecentLogs(20),
    };
  }

  async getRuntimeState(cursor?: string): Promise<DashboardRuntimeStateDto> {
    void cursor;
    return {
      transport: "poll",
      source: "local",
      cursor: createCursor(),
      recommendedPollMs: 3_000,
      incrementalSupported: false,
      snapshot: await this.getSnapshot(),
      updates: [],
    };
  }
}

# Daily Briefing Page (T-005) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/briefing` page that aggregates the last 24h of activity across tasks, agents, sessions, retries, approvals, and timeline events into a structured, at-a-glance daily summary.

**Architecture:** Read-only aggregation of existing DB tables via a new `src/server/briefing.ts` module. Single `GET /api/briefing` endpoint returns the full briefing JSON. Client-side page with date navigation fetches the snapshot on demand (no SSE).

**Tech Stack:** Next.js App Router, TypeScript, Tailwind CSS (dark-only), shadcn/ui primitives, better-sqlite3

---

## File Structure

| File | Responsibility |
|---|---|
| `src/types/briefing.ts` | TypeScript interfaces for the briefing response |
| `src/server/briefing.ts` | SQL aggregation queries across all data sources |
| `app/api/briefing/route.ts` | GET endpoint with `date` and `hours` params |
| `app/briefing/page.tsx` | Server component shell |
| `src/components/BriefingClient.tsx` | Client wrapper with date nav + section layout |
| `src/components/briefing/BriefingHeader.tsx` | Date picker, time window, generation timestamp |
| `src/components/briefing/BriefingInsights.tsx` | Top insight bullets |
| `src/components/briefing/BriefingSection.tsx` | Reusable metric card with title + rows |
| `src/components/briefing/BriefingMetricRow.tsx` | Label + value + optional delta |
| `src/components/briefing/BriefingKeyEvents.tsx` | Chronological event list |
| `src/viewmodels/useBriefingViewModel.ts` | State management: fetch, date nav, caching |
| `src/components/BriefingWidget.tsx` | Dashboard widget showing headline metrics |

---

### Task 1: Types

**Files:**
- Create: `src/types/briefing.ts`

- [ ] **Step 1: Create briefing types**

```typescript
// Briefing types — shared across client and server

export interface BriefingPeriod {
  from: string; // ISO datetime
  to: string;   // ISO datetime
  hours: number;
}

export interface BriefingNotableTask {
  id: string;
  title: string;
  event: string;
  assignee: string;
}

export interface BriefingTasksSummary {
  created: number;
  completed: number;
  moved: number;
  blocked: number;
  completionRate: number;
  notable: BriefingNotableTask[];
}

export interface BriefingAgentStats {
  runs: number;
  completed: number;
  failed: number;
  costUsd: number;
}

export interface BriefingAgentsSummary {
  totalRuns: number;
  completed: number;
  failed: number;
  totalCostUsd: number;
  totalTokens: number;
  avgDurationMs: number;
  mostActive: string;
  byAgent: Record<string, BriefingAgentStats>;
}

export interface BriefingCostliestSession {
  sessionId: string;
  costUsd: number;
  model: string;
}

export interface BriefingSessionsSummary {
  total: number;
  totalCostUsd: number;
  totalTokens: number;
  modelsUsed: string[];
  costliest: BriefingCostliestSession | null;
}

export interface BriefingCostsSummary {
  totalUsd: number;
  breakdown: { agents: number; sessions: number };
  biggestDriver: string;
  spikes: string[];
}

export interface BriefingFailuresSummary {
  detected: number;
  retried: number;
  resolved: number;
  unresolved: number;
}

export interface BriefingApprovalsSummary {
  requested: number;
  approved: number;
  rejected: number;
  expired: number;
  avgResponseTimeMs: number;
}

export interface BriefingKeyEvent {
  title: string;
  occurredAt: string;
}

export interface BriefingData {
  period: BriefingPeriod;
  tasks: BriefingTasksSummary;
  agents: BriefingAgentsSummary;
  sessions: BriefingSessionsSummary;
  costs: BriefingCostsSummary;
  failures: BriefingFailuresSummary;
  approvals: BriefingApprovalsSummary;
  keyEvents: BriefingKeyEvent[];
  insights: string[];
  generatedAt: string;
}
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit src/types/briefing.ts`
Expected: No errors

---

### Task 2: Server-side aggregation

**Files:**
- Create: `src/server/briefing.ts`

- [ ] **Step 1: Create briefing server module**

This module queries each existing table with time-window filters and assembles the unified response. Each section query is wrapped in a try/catch so missing tables (e.g. retries, approvals) degrade gracefully.

```typescript
/**
 * Briefing server module — read-only aggregation across all Mission Control tables.
 * Computes a structured daily summary for a given time window.
 */

import { getDb } from "@/src/server/db";
import type {
  BriefingData,
  BriefingTasksSummary,
  BriefingAgentsSummary,
  BriefingSessionsSummary,
  BriefingCostsSummary,
  BriefingFailuresSummary,
  BriefingApprovalsSummary,
  BriefingKeyEvent,
  BriefingNotableTask,
  BriefingAgentStats,
  BriefingCostliestSession,
} from "@/src/types/briefing";

/** Check if a table exists in the database. */
function tableExists(tableName: string): boolean {
  const db = getDb();
  const row = db
    .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
    .get(tableName) as { name: string } | undefined;
  return !!row;
}

function queryTasksSummary(from: string, to: string): BriefingTasksSummary {
  const db = getDb();

  if (!tableExists("tasks")) {
    return { created: 0, completed: 0, moved: 0, blocked: 0, completionRate: 0, notable: [] };
  }

  const created = (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE created_at >= ? AND created_at < ?"
  ).get(from, to) as { c: number }).c;

  const completed = (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE lane = 'done' AND updated_at >= ? AND updated_at < ?"
  ).get(from, to) as { c: number }).c;

  const blocked = (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE lane = 'blocked' AND updated_at >= ? AND updated_at < ?"
  ).get(from, to) as { c: number }).c;

  // moved = tasks updated in period (lane changes) — approximate via updated_at != created_at
  const moved = (db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE updated_at >= ? AND updated_at < ? AND updated_at != created_at"
  ).get(from, to) as { c: number }).c;

  const completionRate = created > 0 ? completed / created : 0;

  // Notable: recently completed tasks (up to 10)
  const notableRows = db.prepare(
    "SELECT id, title, assignee FROM tasks WHERE lane = 'done' AND updated_at >= ? AND updated_at < ? ORDER BY updated_at DESC LIMIT 10"
  ).all(from, to) as { id: string; title: string; assignee: string }[];

  const notable: BriefingNotableTask[] = notableRows.map((r) => ({
    id: r.id,
    title: r.title,
    event: "completed",
    assignee: r.assignee,
  }));

  return { created, completed, moved, blocked, completionRate, notable };
}

function queryAgentsSummary(from: string, to: string): BriefingAgentsSummary {
  const db = getDb();

  if (!tableExists("agent_activity")) {
    return {
      totalRuns: 0, completed: 0, failed: 0, totalCostUsd: 0, totalTokens: 0,
      avgDurationMs: 0, mostActive: "none", byAgent: {},
    };
  }

  const rows = db.prepare(
    "SELECT agent_type, status, cost_usd, tokens_in, tokens_out, duration_ms FROM agent_activity WHERE started_at >= ? AND started_at < ?"
  ).all(from, to) as {
    agent_type: string; status: string; cost_usd: number;
    tokens_in: number; tokens_out: number; duration_ms: number;
  }[];

  const byAgent: Record<string, BriefingAgentStats> = {};
  let totalCost = 0;
  let totalTokens = 0;
  let totalDuration = 0;
  let completedCount = 0;
  let failedCount = 0;

  for (const row of rows) {
    const agent = row.agent_type;
    if (!byAgent[agent]) {
      byAgent[agent] = { runs: 0, completed: 0, failed: 0, costUsd: 0 };
    }
    byAgent[agent].runs++;
    if (row.status === "completed") {
      byAgent[agent].completed++;
      completedCount++;
    }
    if (row.status === "failed") {
      byAgent[agent].failed++;
      failedCount++;
    }
    byAgent[agent].costUsd += row.cost_usd;
    totalCost += row.cost_usd;
    totalTokens += row.tokens_in + row.tokens_out;
    totalDuration += row.duration_ms;
  }

  // Round costs to 2 decimal places
  for (const stats of Object.values(byAgent)) {
    stats.costUsd = Math.round(stats.costUsd * 100) / 100;
  }

  const totalRuns = rows.length;
  const avgDurationMs = totalRuns > 0 ? Math.round(totalDuration / totalRuns) : 0;

  // Most active = agent with most runs
  let mostActive = "none";
  let maxRuns = 0;
  for (const [agent, stats] of Object.entries(byAgent)) {
    if (stats.runs > maxRuns) {
      maxRuns = stats.runs;
      mostActive = agent;
    }
  }

  return {
    totalRuns,
    completed: completedCount,
    failed: failedCount,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalTokens,
    avgDurationMs,
    mostActive,
    byAgent,
  };
}

function querySessionsSummary(from: string, to: string): BriefingSessionsSummary {
  const db = getDb();

  if (!tableExists("claude_sessions")) {
    return { total: 0, totalCostUsd: 0, totalTokens: 0, modelsUsed: [], costliest: null };
  }

  const rows = db.prepare(
    "SELECT session_id, model, cost_usd, input_tokens, output_tokens FROM claude_sessions WHERE started_at >= ? AND started_at < ?"
  ).all(from, to) as {
    session_id: string; model: string; cost_usd: number;
    input_tokens: number; output_tokens: number;
  }[];

  let totalCost = 0;
  let totalTokens = 0;
  const models = new Set<string>();
  let costliest: BriefingCostliestSession | null = null;

  for (const row of rows) {
    totalCost += row.cost_usd;
    totalTokens += row.input_tokens + row.output_tokens;
    models.add(row.model || "unknown");
    if (!costliest || row.cost_usd > costliest.costUsd) {
      costliest = {
        sessionId: row.session_id,
        costUsd: Math.round(row.cost_usd * 100) / 100,
        model: row.model || "unknown",
      };
    }
  }

  return {
    total: rows.length,
    totalCostUsd: Math.round(totalCost * 100) / 100,
    totalTokens,
    modelsUsed: Array.from(models),
    costliest,
  };
}

function queryFailuresSummary(from: string, to: string): BriefingFailuresSummary {
  const db = getDb();

  if (!tableExists("retries")) {
    return { detected: 0, retried: 0, resolved: 0, unresolved: 0 };
  }

  const detected = (db.prepare(
    "SELECT COUNT(*) as c FROM retries WHERE created_at >= ? AND created_at < ?"
  ).get(from, to) as { c: number }).c;

  const retried = (db.prepare(
    "SELECT COUNT(*) as c FROM retries WHERE created_at >= ? AND created_at < ? AND attempt_count > 0"
  ).get(from, to) as { c: number }).c;

  const resolved = (db.prepare(
    "SELECT COUNT(*) as c FROM retries WHERE created_at >= ? AND created_at < ? AND status = 'resolved'"
  ).get(from, to) as { c: number }).c;

  const unresolved = (db.prepare(
    "SELECT COUNT(*) as c FROM retries WHERE created_at >= ? AND created_at < ? AND status IN ('failed', 'retrying')"
  ).get(from, to) as { c: number }).c;

  return { detected, retried, resolved, unresolved };
}

function queryApprovalsSummary(from: string, to: string): BriefingApprovalsSummary {
  const db = getDb();

  if (!tableExists("approvals")) {
    return { requested: 0, approved: 0, rejected: 0, expired: 0, avgResponseTimeMs: 0 };
  }

  const requested = (db.prepare(
    "SELECT COUNT(*) as c FROM approvals WHERE created_at >= ? AND created_at < ?"
  ).get(from, to) as { c: number }).c;

  const approved = (db.prepare(
    "SELECT COUNT(*) as c FROM approvals WHERE created_at >= ? AND created_at < ? AND status = 'approved'"
  ).get(from, to) as { c: number }).c;

  const rejected = (db.prepare(
    "SELECT COUNT(*) as c FROM approvals WHERE created_at >= ? AND created_at < ? AND status = 'rejected'"
  ).get(from, to) as { c: number }).c;

  const expired = (db.prepare(
    "SELECT COUNT(*) as c FROM approvals WHERE created_at >= ? AND created_at < ? AND status = 'expired'"
  ).get(from, to) as { c: number }).c;

  // Average response time for resolved approvals
  const avgRow = db.prepare(`
    SELECT AVG(
      (julianday(resolved_at) - julianday(created_at)) * 86400000
    ) as avg_ms
    FROM approvals
    WHERE created_at >= ? AND created_at < ?
      AND resolved_at IS NOT NULL
  `).get(from, to) as { avg_ms: number | null };

  return {
    requested,
    approved,
    rejected,
    expired,
    avgResponseTimeMs: Math.round(avgRow.avg_ms ?? 0),
  };
}

function queryKeyEvents(from: string, to: string): BriefingKeyEvent[] {
  const db = getDb();

  if (!tableExists("timeline_events")) {
    return [];
  }

  // Get notable events: cost spikes, failures, and high-impact events (up to 10)
  const rows = db.prepare(`
    SELECT title, occurred_at FROM timeline_events
    WHERE occurred_at >= ? AND occurred_at < ?
      AND (event_type LIKE 'cost.%' OR event_type LIKE '%.failed' OR event_type LIKE 'retry.%')
    ORDER BY occurred_at DESC
    LIMIT 10
  `).all(from, to) as { title: string; occurred_at: string }[];

  return rows.map((r) => ({ title: r.title, occurredAt: r.occurred_at }));
}

function generateInsights(
  tasks: BriefingTasksSummary,
  agents: BriefingAgentsSummary,
  sessions: BriefingSessionsSummary,
  failures: BriefingFailuresSummary,
  costs: BriefingCostsSummary,
): string[] {
  const insights: string[] = [];

  // Task completion rate
  if (tasks.created > 0) {
    const pct = Math.round(tasks.completionRate * 100);
    insights.push(`Task completion rate: ${pct}% (${tasks.completed} of ${tasks.created} created tasks completed)`);
  }

  // Biggest cost driver
  if (costs.totalUsd > 0) {
    insights.push(`Biggest cost driver: ${costs.biggestDriver}`);
  }

  // Unresolved failures
  if (failures.unresolved > 0) {
    insights.push(`${failures.unresolved} unresolved failure${failures.unresolved !== 1 ? "s" : ""} still need attention`);
  }

  // Agent success rate
  if (agents.totalRuns > 0) {
    const successRate = Math.round((agents.completed / agents.totalRuns) * 100);
    insights.push(`Agent success rate: ${successRate}% (${agents.completed}/${agents.totalRuns} runs)`);
  }

  // Session cost
  if (sessions.total > 0) {
    insights.push(`${sessions.total} Claude session${sessions.total !== 1 ? "s" : ""} used, costing $${sessions.totalCostUsd.toFixed(2)}`);
  }

  // Quiet day fallback
  if (insights.length === 0) {
    insights.push("Quiet day \u2014 no activity recorded");
  }

  return insights.slice(0, 5);
}

export function getBriefing(date?: string, hours?: number): BriefingData {
  const windowHours = Math.min(Math.max(hours ?? 24, 1), 168);

  let to: Date;
  if (date) {
    // End of the specified day
    to = new Date(date + "T23:59:59.999Z");
  } else {
    to = new Date();
  }

  const from = new Date(to.getTime() - windowHours * 60 * 60 * 1000);

  const fromISO = from.toISOString();
  const toISO = to.toISOString();

  const tasks = queryTasksSummary(fromISO, toISO);
  const agents = queryAgentsSummary(fromISO, toISO);
  const sessions = querySessionsSummary(fromISO, toISO);
  const failures = queryFailuresSummary(fromISO, toISO);
  const approvals = queryApprovalsSummary(fromISO, toISO);
  const keyEvents = queryKeyEvents(fromISO, toISO);

  // Costs summary
  const agentCost = agents.totalCostUsd;
  const sessionCost = sessions.totalCostUsd;
  const totalCost = Math.round((agentCost + sessionCost) * 100) / 100;

  // Determine biggest driver
  let biggestDriver = "No cost data";
  if (totalCost > 0) {
    if (agentCost >= sessionCost && agents.mostActive !== "none") {
      const agentStats = agents.byAgent[agents.mostActive];
      biggestDriver = `${agents.mostActive} \u2014 ${agentStats?.runs ?? 0} runs totalling $${agentStats?.costUsd.toFixed(2) ?? "0.00"}`;
    } else if (sessions.costliest) {
      biggestDriver = `Session ${sessions.costliest.sessionId.slice(0, 8)} ($${sessions.costliest.costUsd.toFixed(2)}, ${sessions.costliest.model})`;
    }
  }

  // Cost spikes from timeline
  const spikeEvents = keyEvents
    .filter((e) => e.title.toLowerCase().includes("cost spike"))
    .map((e) => e.title);

  const costs: BriefingCostsSummary = {
    totalUsd: totalCost,
    breakdown: { agents: agentCost, sessions: sessionCost },
    biggestDriver,
    spikes: spikeEvents,
  };

  const insights = generateInsights(tasks, agents, sessions, failures, costs);

  return {
    period: { from: fromISO, to: toISO, hours: windowHours },
    tasks,
    agents,
    sessions,
    costs,
    failures,
    approvals,
    keyEvents,
    insights,
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 2: Verify server module compiles**

Run: `npx tsc --noEmit src/server/briefing.ts`
Expected: No errors

---

### Task 3: API Route

**Files:**
- Create: `app/api/briefing/route.ts`

- [ ] **Step 1: Create the briefing API route**

```typescript
import { NextResponse } from "next/server";
import { getBriefing } from "@/src/server/briefing";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get("date") ?? undefined;
  const hoursParam = searchParams.get("hours");
  const hours = hoursParam ? parseInt(hoursParam, 10) : undefined;

  // Validate date format if provided
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return NextResponse.json(
      { error: "Invalid date format. Use YYYY-MM-DD." },
      { status: 400 },
    );
  }

  // Validate hours if provided
  if (hours !== undefined && (isNaN(hours) || hours < 1 || hours > 168)) {
    return NextResponse.json(
      { error: "Hours must be between 1 and 168." },
      { status: 400 },
    );
  }

  // Check for future date
  if (date) {
    const requestedDate = new Date(date + "T23:59:59.999Z");
    if (requestedDate > new Date()) {
      return NextResponse.json({
        period: { from: date + "T00:00:00.000Z", to: date + "T23:59:59.999Z", hours: hours ?? 24 },
        tasks: { created: 0, completed: 0, moved: 0, blocked: 0, completionRate: 0, notable: [] },
        agents: { totalRuns: 0, completed: 0, failed: 0, totalCostUsd: 0, totalTokens: 0, avgDurationMs: 0, mostActive: "none", byAgent: {} },
        sessions: { total: 0, totalCostUsd: 0, totalTokens: 0, modelsUsed: [], costliest: null },
        costs: { totalUsd: 0, breakdown: { agents: 0, sessions: 0 }, biggestDriver: "No data available for future dates", spikes: [] },
        failures: { detected: 0, retried: 0, resolved: 0, unresolved: 0 },
        approvals: { requested: 0, approved: 0, rejected: 0, expired: 0, avgResponseTimeMs: 0 },
        keyEvents: [],
        insights: ["No data available for future dates"],
        generatedAt: new Date().toISOString(),
      });
    }
  }

  const briefing = getBriefing(date, hours);
  return NextResponse.json(briefing);
}
```

- [ ] **Step 2: Verify the route compiles**

Run: `npx tsc --noEmit app/api/briefing/route.ts`
Expected: No errors

---

### Task 4: ViewModel

**Files:**
- Create: `src/viewmodels/useBriefingViewModel.ts`

- [ ] **Step 1: Create the briefing view model**

```typescript
"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { BriefingData } from "@/src/types/briefing";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function useBriefingViewModel() {
  const [briefing, setBriefing] = useState<BriefingData | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(todayISO());
  const [isLoading, setIsLoading] = useState(true);
  const cacheRef = useRef<Map<string, BriefingData>>(new Map());

  const fetchBriefing = useCallback(async (date: string) => {
    // Check cache first
    const cached = cacheRef.current.get(date);
    if (cached) {
      setBriefing(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`/api/briefing?date=${date}`);
      if (!res.ok) throw new Error(`Failed to fetch briefing: ${res.status}`);
      const data: BriefingData = await res.json();
      cacheRef.current.set(date, data);
      setBriefing(data);
    } catch {
      setBriefing(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBriefing(selectedDate);
  }, [selectedDate, fetchBriefing]);

  const setDate = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const prevDay = useCallback(() => {
    const d = new Date(selectedDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    setSelectedDate(d.toISOString().slice(0, 10));
  }, [selectedDate]);

  const nextDay = useCallback(() => {
    const d = new Date(selectedDate + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + 1);
    const next = d.toISOString().slice(0, 10);
    // Don't go past today
    if (next <= todayISO()) {
      setSelectedDate(next);
    }
  }, [selectedDate]);

  const refresh = useCallback(() => {
    // Clear cache for current date and re-fetch
    cacheRef.current.delete(selectedDate);
    fetchBriefing(selectedDate);
  }, [selectedDate, fetchBriefing]);

  const isToday = selectedDate === todayISO();

  return {
    briefing,
    selectedDate,
    isLoading,
    isToday,
    setDate,
    prevDay,
    nextDay,
    refresh,
  };
}
```

- [ ] **Step 2: Verify viewmodel compiles**

Run: `npx tsc --noEmit src/viewmodels/useBriefingViewModel.ts`
Expected: No errors

---

### Task 5: Briefing Sub-components

**Files:**
- Create: `src/components/briefing/BriefingHeader.tsx`
- Create: `src/components/briefing/BriefingInsights.tsx`
- Create: `src/components/briefing/BriefingSection.tsx`
- Create: `src/components/briefing/BriefingMetricRow.tsx`
- Create: `src/components/briefing/BriefingKeyEvents.tsx`

- [ ] **Step 1: Create BriefingMetricRow**

```typescript
"use client";

interface BriefingMetricRowProps {
  label: string;
  value: string | number;
  detail?: string;
}

export function BriefingMetricRow({ label, value, detail }: BriefingMetricRowProps) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <div className="text-right">
        <span className="font-medium text-foreground">{value}</span>
        {detail && <div className="text-muted-foreground">{detail}</div>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create BriefingSection**

```typescript
"use client";

import type React from "react";
import { Panel } from "@/src/components/primitives";

interface BriefingSectionProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function BriefingSection({ title, description, children }: BriefingSectionProps) {
  return (
    <Panel title={title} description={description}>
      <div className="space-y-2">{children}</div>
    </Panel>
  );
}
```

- [ ] **Step 3: Create BriefingHeader**

```typescript
"use client";

import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { SectionHeader } from "@/src/components/primitives";

interface BriefingHeaderProps {
  selectedDate: string;
  isToday: boolean;
  generatedAt?: string;
  hours: number;
  onPrevDay: () => void;
  onNextDay: () => void;
  onRefresh: () => void;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export function BriefingHeader({
  selectedDate,
  isToday,
  generatedAt,
  hours,
  onPrevDay,
  onNextDay,
  onRefresh,
}: BriefingHeaderProps) {
  const genTime = generatedAt
    ? new Date(generatedAt).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <SectionHeader
      title="Daily Briefing"
      description={`Last ${hours} hours${genTime ? ` \u00b7 Generated at ${genTime}` : ""}`}
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={onPrevDay}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="min-w-[100px] text-center text-sm font-medium">
            {isToday ? "Today" : formatDate(selectedDate)}
          </span>
          <button
            onClick={onNextDay}
            disabled={isToday}
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={onRefresh}
            className="ml-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
            aria-label="Refresh briefing"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      }
    />
  );
}
```

- [ ] **Step 4: Create BriefingInsights**

```typescript
"use client";

import { Lightbulb } from "lucide-react";
import { Panel } from "@/src/components/primitives";

interface BriefingInsightsProps {
  insights: string[];
}

export function BriefingInsights({ insights }: BriefingInsightsProps) {
  return (
    <Panel title="Insights">
      <div className="space-y-1.5">
        {insights.map((insight, i) => (
          <div key={i} className="flex items-start gap-2 text-xs">
            <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400/80" />
            <span className="text-foreground">{insight}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 5: Create BriefingKeyEvents**

```typescript
"use client";

import { Panel } from "@/src/components/primitives";
import type { BriefingKeyEvent } from "@/src/types/briefing";

interface BriefingKeyEventsProps {
  events: BriefingKeyEvent[];
}

function formatTime(isoStr: string): string {
  return new Date(isoStr).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function BriefingKeyEvents({ events }: BriefingKeyEventsProps) {
  if (events.length === 0) {
    return (
      <Panel title="Key Events">
        <p className="text-xs text-muted-foreground">No notable events in this period.</p>
      </Panel>
    );
  }

  return (
    <Panel title="Key Events">
      <div className="space-y-2">
        {events.map((event, i) => (
          <div key={i} className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
            <span className="shrink-0 font-mono text-muted-foreground">{formatTime(event.occurredAt)}</span>
            <span className="text-foreground">{event.title}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
```

- [ ] **Step 6: Verify all sub-components compile**

Run: `npx tsc --noEmit src/components/briefing/BriefingHeader.tsx src/components/briefing/BriefingInsights.tsx src/components/briefing/BriefingSection.tsx src/components/briefing/BriefingMetricRow.tsx src/components/briefing/BriefingKeyEvents.tsx`
Expected: No errors

---

### Task 6: BriefingClient and Page

**Files:**
- Create: `src/components/BriefingClient.tsx`
- Create: `app/briefing/page.tsx`

- [ ] **Step 1: Create BriefingClient**

```typescript
"use client";

import { useBriefingViewModel } from "@/src/viewmodels/useBriefingViewModel";
import { BriefingHeader } from "@/src/components/briefing/BriefingHeader";
import { BriefingInsights } from "@/src/components/briefing/BriefingInsights";
import { BriefingSection } from "@/src/components/briefing/BriefingSection";
import { BriefingMetricRow } from "@/src/components/briefing/BriefingMetricRow";
import { BriefingKeyEvents } from "@/src/components/briefing/BriefingKeyEvents";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${Math.round(n / 1_000)}K`;
  return String(n);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = Math.round(ms / 1000);
  if (sec < 60) return `${sec}s`;
  return `${Math.round(sec / 60)}m`;
}

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-32 rounded-xl border border-border/40 bg-muted/20" />
      ))}
    </div>
  );
}

export function BriefingClient() {
  const {
    briefing,
    selectedDate,
    isLoading,
    isToday,
    prevDay,
    nextDay,
    refresh,
  } = useBriefingViewModel();

  return (
    <div className="space-y-6">
      <BriefingHeader
        selectedDate={selectedDate}
        isToday={isToday}
        generatedAt={briefing?.generatedAt}
        hours={briefing?.period.hours ?? 24}
        onPrevDay={prevDay}
        onNextDay={nextDay}
        onRefresh={refresh}
      />

      {isLoading ? (
        <LoadingSkeleton />
      ) : !briefing ? (
        <div className="rounded-xl border border-dashed border-border/60 bg-background/20 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Failed to load briefing data.</p>
        </div>
      ) : (
        <>
          {/* Insights */}
          <BriefingInsights insights={briefing.insights} />

          {/* Tasks + Agents */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BriefingSection title="Tasks" description="Task activity in this period.">
              <BriefingMetricRow label="Created" value={briefing.tasks.created} />
              <BriefingMetricRow label="Completed" value={briefing.tasks.completed} />
              <BriefingMetricRow label="Blocked" value={briefing.tasks.blocked} />
              <BriefingMetricRow
                label="Completion rate"
                value={`${Math.round(briefing.tasks.completionRate * 100)}%`}
              />
              {briefing.tasks.notable.length > 0 && (
                <div className="mt-2 space-y-1">
                  <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Notable</div>
                  {briefing.tasks.notable.slice(0, 5).map((t) => (
                    <div key={t.id} className="text-xs text-foreground">
                      {t.title} <span className="text-muted-foreground">({t.assignee})</span>
                    </div>
                  ))}
                </div>
              )}
            </BriefingSection>

            <BriefingSection title="Agents" description="Agent run performance.">
              <BriefingMetricRow
                label="Runs"
                value={briefing.agents.totalRuns}
                detail={`${briefing.agents.completed}\u2713 ${briefing.agents.failed}\u2717`}
              />
              <BriefingMetricRow label="Cost" value={`$${briefing.agents.totalCostUsd.toFixed(2)}`} />
              <BriefingMetricRow label="Tokens" value={formatTokens(briefing.agents.totalTokens)} />
              <BriefingMetricRow label="Avg duration" value={formatDuration(briefing.agents.avgDurationMs)} />
              {briefing.agents.mostActive !== "none" && (
                <BriefingMetricRow
                  label="Most active"
                  value={briefing.agents.mostActive}
                  detail={`${briefing.agents.byAgent[briefing.agents.mostActive]?.runs ?? 0} runs`}
                />
              )}
            </BriefingSection>
          </section>

          {/* Sessions + Costs */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BriefingSection title="Sessions" description="Claude Code sessions.">
              <BriefingMetricRow label="Total" value={briefing.sessions.total} />
              <BriefingMetricRow label="Cost" value={`$${briefing.sessions.totalCostUsd.toFixed(2)}`} />
              <BriefingMetricRow label="Models" value={briefing.sessions.modelsUsed.length || "N/A"} />
              {briefing.sessions.costliest && (
                <BriefingMetricRow
                  label="Costliest"
                  value={`$${briefing.sessions.costliest.costUsd.toFixed(2)}`}
                  detail={briefing.sessions.costliest.model}
                />
              )}
            </BriefingSection>

            <BriefingSection title="Costs" description="Total spend breakdown.">
              <BriefingMetricRow label="Total" value={`$${briefing.costs.totalUsd.toFixed(2)}`} />
              <BriefingMetricRow
                label="Agents"
                value={`$${briefing.costs.breakdown.agents.toFixed(2)}`}
                detail={briefing.costs.totalUsd > 0 ? `${Math.round((briefing.costs.breakdown.agents / briefing.costs.totalUsd) * 100)}%` : undefined}
              />
              <BriefingMetricRow
                label="Sessions"
                value={`$${briefing.costs.breakdown.sessions.toFixed(2)}`}
                detail={briefing.costs.totalUsd > 0 ? `${Math.round((briefing.costs.breakdown.sessions / briefing.costs.totalUsd) * 100)}%` : undefined}
              />
              {briefing.costs.biggestDriver !== "No cost data" && (
                <BriefingMetricRow label="Biggest driver" value={briefing.costs.biggestDriver} />
              )}
            </BriefingSection>
          </section>

          {/* Failures + Approvals */}
          <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
            <BriefingSection title="Failures" description="Retry center activity.">
              <BriefingMetricRow label="Detected" value={briefing.failures.detected} />
              <BriefingMetricRow label="Resolved" value={briefing.failures.resolved} />
              <BriefingMetricRow label="Pending" value={briefing.failures.unresolved} />
            </BriefingSection>

            <BriefingSection title="Approvals" description="Human-in-the-loop requests.">
              <BriefingMetricRow label="Requested" value={briefing.approvals.requested} />
              <BriefingMetricRow label="Approved" value={briefing.approvals.approved} />
              <BriefingMetricRow label="Rejected" value={briefing.approvals.rejected} />
              <BriefingMetricRow label="Expired" value={briefing.approvals.expired} />
            </BriefingSection>
          </section>

          {/* Key Events */}
          <BriefingKeyEvents events={briefing.keyEvents} />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Create briefing page**

```typescript
import { BriefingClient } from "@/src/components/BriefingClient";

export default async function BriefingPage() {
  return <BriefingClient />;
}
```

- [ ] **Step 3: Verify page compiles**

Run: `npx tsc --noEmit app/briefing/page.tsx src/components/BriefingClient.tsx`
Expected: No errors

---

### Task 7: Dashboard Widget

**Files:**
- Create: `src/components/BriefingWidget.tsx`
- Modify: `app/page.tsx`
- Modify: `src/components/DashboardClient.tsx`

- [ ] **Step 1: Create BriefingWidget**

```typescript
"use client";

import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { Panel } from "@/src/components/primitives";

interface BriefingWidgetProps {
  totalCostUsd: number;
  taskCompletionRate: number;
  agentRuns: number;
  failuresUnresolved: number;
}

export function BriefingWidget({
  totalCostUsd,
  taskCompletionRate,
  agentRuns,
  failuresUnresolved,
}: BriefingWidgetProps) {
  const hasData = totalCostUsd > 0 || agentRuns > 0;

  return (
    <Panel title="Daily Briefing" description="Today's headline metrics.">
      {hasData ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="text-muted-foreground">Cost</div>
              <div className="font-medium text-foreground">${totalCostUsd.toFixed(2)}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="text-muted-foreground">Tasks</div>
              <div className="font-medium text-foreground">{Math.round(taskCompletionRate * 100)}%</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="text-muted-foreground">Agent runs</div>
              <div className="font-medium text-foreground">{agentRuns}</div>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <div className="text-muted-foreground">Failures</div>
              <div className={`font-medium ${failuresUnresolved > 0 ? "text-red-300" : "text-foreground"}`}>
                {failuresUnresolved}
              </div>
            </div>
          </div>
          <Link
            href="/briefing"
            className="mt-1 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Full briefing
            <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center">
          <Newspaper className="mx-auto mb-1 h-5 w-5 text-muted-foreground/50" />
          <p className="text-xs text-muted-foreground">No activity today yet.</p>
        </div>
      )}
    </Panel>
  );
}
```

- [ ] **Step 2: Add BriefingWidget to dashboard server component**

In `app/page.tsx`, add briefing data fetch and pass to DashboardClient:

```typescript
import { DashboardClient } from "@/src/components/DashboardClient";
import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";
import { getRecentEvents } from "@/src/server/timeline";
import { getApprovals } from "@/src/server/approvals";
import { getRetries } from "@/src/server/retries";
import { getBriefing } from "@/src/server/briefing";

export default async function Home() {
  const runtime = await getDashboardRuntimeState();
  const recentTimelineEvents = getRecentEvents(5);
  const approvalsData = getApprovals({ status: "pending", limit: 1 });
  const retriesData = getRetries({ status: "failed", limit: 1 });
  const briefing = getBriefing();

  return (
    <DashboardClient
      initialRuntime={runtime}
      recentTimelineEvents={recentTimelineEvents}
      approvalsPendingCount={approvalsData.pendingCount}
      approvalsOldest={approvalsData.approvals[0] ?? null}
      retriesFailedCount={retriesData.failedCount}
      retriesMostRecent={retriesData.retries[0] ?? null}
      briefingCostUsd={briefing.costs.totalUsd}
      briefingTaskCompletionRate={briefing.tasks.completionRate}
      briefingAgentRuns={briefing.agents.totalRuns}
      briefingFailuresUnresolved={briefing.failures.unresolved}
    />
  );
}
```

- [ ] **Step 3: Wire BriefingWidget into DashboardClient**

Add to DashboardClient props and render in the widget grid. In `src/components/DashboardClient.tsx`:

1. Add props: `briefingCostUsd?: number; briefingTaskCompletionRate?: number; briefingAgentRuns?: number; briefingFailuresUnresolved?: number;`
2. Import `BriefingWidget` from `@/src/components/BriefingWidget`
3. Add `<BriefingWidget ... />` in the bottom widget grid section (replace the "Recent logs" panel or add alongside it)

Specifically, add to the destructured props in the component signature:
```typescript
briefingCostUsd = 0, briefingTaskCompletionRate = 0, briefingAgentRuns = 0, briefingFailuresUnresolved = 0
```

Add import:
```typescript
import { BriefingWidget } from "@/src/components/BriefingWidget";
```

In the bottom `<section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr]">` section, add after RetriesWidget:
```tsx
<BriefingWidget
  totalCostUsd={briefingCostUsd}
  taskCompletionRate={briefingTaskCompletionRate}
  agentRuns={briefingAgentRuns}
  failuresUnresolved={briefingFailuresUnresolved}
/>
```

---

### Task 8: Navigation + Command Palette

**Files:**
- Modify: `src/components/primitives/AppShell.tsx`
- Modify: `src/components/CommandPalette.tsx`

- [ ] **Step 1: Add Briefing to AppShell sidebar nav**

In `src/components/primitives/AppShell.tsx`, add to `navItems` array (before "Settings"):

```typescript
{ label: "Briefing", href: "/briefing" },
```

Insert after `{ label: "Office", href: "/office" },` and before `{ label: "Settings", href: "/settings" },`.

- [ ] **Step 2: Add "Go to Briefing" command to CommandPalette**

In `src/components/CommandPalette.tsx`:

1. Add `Newspaper` to the lucide-react import
2. Add the following command entry to the `commands` array, before the settings entry:

```typescript
{
  id: "nav-briefing",
  label: "Go to Briefing",
  shortcut: "G B",
  icon: <Newspaper className="size-4" />,
  action: () => { router.push("/briefing"); setOpen(false); },
  group: "Navigation",
},
```

---

### Task 9: Print Styles

**Files:**
- Modify: `styles/tokens.css` (append print media query)

- [ ] **Step 1: Add print-friendly CSS**

Append to the end of `styles/tokens.css`:

```css
@media print {
  /* Hide navigation and interactive elements */
  aside,
  header,
  [aria-label="Previous day"],
  [aria-label="Next day"],
  [aria-label="Refresh briefing"],
  nav {
    display: none !important;
  }

  /* Reset backgrounds for print */
  body,
  .bg-background,
  .glass-panel {
    background: white !important;
    color: black !important;
  }

  /* Ensure cards have visible borders */
  .border-border\/80,
  .border-border\/60 {
    border-color: #ccc !important;
  }

  /* Remove shadows and backdrop effects */
  * {
    box-shadow: none !important;
    backdrop-filter: none !important;
  }

  /* Text colors for readability */
  .text-foreground { color: black !important; }
  .text-muted-foreground { color: #666 !important; }

  /* Full-width layout */
  .xl\:grid-cols-\[220px_minmax\(0\2c 1fr\)_300px\] {
    grid-template-columns: 1fr !important;
  }
}
```

---

### Task 10: Build Verification + CLAUDE.md Update

- [ ] **Step 1: Run full build**

Run: `npm run build 2>&1 | tee /Users/nigel/claude-code-runs/20260328-191100-T005-buildplan.log`
Expected: Build succeeds with no errors

- [ ] **Step 2: Run lint**

Run: `npm run lint 2>&1 | tee -a /Users/nigel/claude-code-runs/20260328-191100-T005-buildplan.log`
Expected: No lint errors

- [ ] **Step 3: Run TypeScript check**

Run: `npm run tsc-lint 2>&1 | tee -a /Users/nigel/claude-code-runs/20260328-191100-T005-buildplan.log`
Expected: No type errors

- [ ] **Step 4: Update CLAUDE.md**

Add a new section under `## Recent Additions` for the Daily Briefing Page:

```markdown
### Daily Briefing Page (`/briefing`) — T-005
- Structured at-a-glance summary of the last 24 hours across all surfaces
- **No new DB tables:** Read-only aggregation of existing `tasks`, `agent_activity`, `claude_sessions`, `timeline_events`, `approvals`, `retries` tables
- **Server:** `src/server/briefing.ts` — time-windowed SQL aggregation per data source with graceful degradation for missing tables
- **API:** `GET /api/briefing` with `date` (YYYY-MM-DD) and `hours` (1-168) query params
- **Types:** `src/types/briefing.ts` — `BriefingData`, `BriefingTasksSummary`, `BriefingAgentsSummary`, `BriefingSessionsSummary`, `BriefingCostsSummary`, `BriefingFailuresSummary`, `BriefingApprovalsSummary`
- **Page:** `app/briefing/page.tsx` → `BriefingClient` → `useBriefingViewModel`
- **Components:** `BriefingHeader`, `BriefingInsights`, `BriefingSection`, `BriefingMetricRow`, `BriefingKeyEvents` in `src/components/briefing/`
- **Dashboard widget:** `BriefingWidget` shows today's cost, task rate, agent runs, failures
- **Nav:** "Briefing" in AppShell sidebar + "Go to Briefing" (G B) in CommandPalette
- **Date navigation:** Prev/next day buttons, cached responses, no-future-date guard
- **Insights:** Auto-generated top 5 observations (completion rate, cost driver, failures, success rate, session count)
- **Print:** `@media print` styles for clean printed briefings
- **Zero-data:** Graceful "Quiet day" state when no activity
- **Future dates:** Returns empty briefing with "No data available" message
```

Also update the build plan table to mark T-005 as Implemented:

```markdown
| `buildplan-T-005.md` | Daily Briefing Page | Implemented |
```

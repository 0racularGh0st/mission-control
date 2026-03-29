"use client";

import type React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowUpRight, Bot, Clock3, Command, Cpu, ListTodo, Router } from "lucide-react";

import { CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";
import { TimelineWidget } from "@/src/components/TimelineWidget";
import { ApprovalsWidget } from "@/src/components/ApprovalsWidget";
import { RetriesWidget } from "@/src/components/RetriesWidget";
import { MemoryWidget } from "@/src/components/MemoryWidget";
import { TasksWidget } from "@/src/components/TasksWidget";
import type { TaskLaneCounts } from "@/src/components/TasksWidget";
import type { DashboardRuntimeStateDto } from "@/src/runtime/dashboard/types";
import type { TimelineEvent } from "@/src/types/timeline";
import type { Approval } from "@/src/types/approvals";
import type { RetryEntry } from "@/src/types/retries";
import type { MemoryStats } from "@/src/types/memory";
import { useDashboardRuntime } from "@/src/runtime/dashboard/useDashboardRuntime";
import { type BadgeTone, useDashboardViewModel } from "@/src/viewmodels/useDashboardViewModel";

const CURSOR_STORAGE_KEY = "mission-control.dashboard.cursor";

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: BadgeTone }) {
  const toneClass =
    tone === "critical"
      ? "bg-destructive/15 text-destructive border-destructive/35"
      : tone === "warning"
        ? "bg-amber-400/10 text-amber-200 border-amber-400/30"
        : "bg-muted/50 text-muted-foreground border-border";

  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

export function DashboardClient({
  initialRuntime,
  recentTimelineEvents = [],
  approvalsPendingCount = 0,
  approvalsOldest = null,
  retriesFailedCount = 0,
  retriesMostRecent = null,
  memoryStats,
  taskLaneCounts,
}: {
  initialRuntime: DashboardRuntimeStateDto;
  recentTimelineEvents?: TimelineEvent[];
  approvalsPendingCount?: number;
  approvalsOldest?: Approval | null;
  retriesFailedCount?: number;
  retriesMostRecent?: RetryEntry | null;
  memoryStats?: MemoryStats;
  taskLaneCounts?: TaskLaneCounts;
}) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });

  const { metrics, agents, queueLanes, tokenRows, routes, alerts, recentLogs, hasLogs } = useDashboardViewModel(snapshot);

  return (
    <main className="dashboard-shell space-y-8">
      {/* ── Hero header ── */}
      <SectionHeader
        title="Mission Control"
        description={`Keyboard-first operations view · ${runtimeMeta.source} · ${runtimeMeta.transport}`}
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            <span>⌘K to jump anywhere</span>
          </div>
        }
      />

      {/* ── Key metrics ── */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} className="glass-panel accent-glow" />
        ))}
      </section>

      {/* ── Primary widget grid: T-001..T-006 surfaces ── */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Subsystems</h3>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          <TimelineWidget events={recentTimelineEvents} />
          <ApprovalsWidget pendingCount={approvalsPendingCount} oldest={approvalsOldest} />
          <RetriesWidget failedCount={retriesFailedCount} mostRecent={retriesMostRecent} />
          {taskLaneCounts && <TasksWidget laneCounts={taskLaneCounts} />}
          {memoryStats && <MemoryWidget stats={memoryStats} />}
          <Panel title="Token & cost summary" description="Usage and spend trend for this session window.">
            <div className="space-y-2">
              {tokenRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                  <span className="text-muted-foreground">{row.label}</span>
                  <div className="text-right">
                    <div className="font-medium text-foreground">{row.valueLabel}</div>
                    <div className="text-muted-foreground">{row.deltaLabel}</div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ── Operational panels ── */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Operations</h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <Panel title="Active agents" description="Live worker status, queue load, and median latency by role.">
            <div className="space-y-2">
              {agents.map((agent) => (
                <div key={agent.id} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-foreground">{agent.name}</div>
                    <div className="truncate text-muted-foreground">{agent.role}</div>
                  </div>
                  <Badge tone={agent.healthTone}>{agent.healthLabel}</Badge>
                  <div className="text-muted-foreground">{agent.model}</div>
                  <div className="text-muted-foreground">{agent.queueDepthLabel}</div>
                  <div className="text-right text-muted-foreground">{agent.latencyLabel}</div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="Model routing summary" description="Live traffic split across active model providers.">
            <div className="space-y-2">
              {routes.map((route) => (
                <div key={route.model} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                  <Router className="h-3.5 w-3.5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{route.model}</div>
                    <div className="text-muted-foreground">{route.role}</div>
                  </div>
                  <span className="text-muted-foreground">{route.shareLabel}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </section>

      {/* ── Alerts + Logs + Quick actions ── */}
      <section>
        <h3 className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Situation</h3>
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <Panel title="Alerts / stuck tasks" description="Priority issues requiring operator action.">
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 font-medium">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                        {alert.title}
                      </div>
                      <Badge tone={alert.severityTone}>{alert.severityLabel}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.detail}</p>
                  </div>
                ))}
              </div>
          </Panel>

          <Panel title="Recent logs" description="Latest execution and orchestration events from runtime.">
              {hasLogs ? (
                <div className="space-y-2 font-mono text-xs">
                  {recentLogs.map((entry) => (
                    <div key={entry.id} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
                      {entry.message}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-xs text-muted-foreground">
                  No runtime logs yet. Execution events will stream here once tasks begin.
                </div>
              )}
          </Panel>

          <Panel>
              <CardTitle className="mb-1">Operator quick actions</CardTitle>
              <CardDescription className="mb-4">Fast keyboard-centric controls for common interventions.</CardDescription>
              <div className="space-y-2 text-xs">
                <Link href="/agents" className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 transition-colors hover:border-border hover:bg-background/50">
                  <span className="flex items-center gap-2">
                    <Bot className="h-3.5 w-3.5" />Focus active agent
                  </span>
                  <span className="text-muted-foreground">A</span>
                </Link>
                <Link href="/tasks" className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 transition-colors hover:border-border hover:bg-background/50">
                  <span className="flex items-center gap-2">
                    <ListTodo className="h-3.5 w-3.5" />Open task board
                  </span>
                  <span className="text-muted-foreground">Q</span>
                </Link>
                <Link href="/models" className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 transition-colors hover:border-border hover:bg-background/50">
                  <span className="flex items-center gap-2">
                    <Cpu className="h-3.5 w-3.5" />Inspect model fallback
                  </span>
                  <span className="text-muted-foreground">M</span>
                </Link>
                <Link href="/tasks" className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 transition-colors hover:border-border hover:bg-background/50">
                  <span className="flex items-center gap-2">
                    <Clock3 className="h-3.5 w-3.5" />Stale task triage
                  </span>
                  <span className="text-muted-foreground">T</span>
                </Link>
                <Link href="/approvals" className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 transition-colors hover:border-border hover:bg-background/50">
                  <span className="flex items-center gap-2">
                    <ArrowUpRight className="h-3.5 w-3.5" />Escalate to primary
                  </span>
                  <span className="text-muted-foreground">E</span>
                </Link>
              </div>
          </Panel>
        </div>
      </section>
    </main>
  );
}

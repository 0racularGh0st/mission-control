"use client";

import type React from "react";
import { AlertTriangle, ArrowUpRight, Bot, Clock3, Command, Cpu, DollarSign, Layers3, ListTodo, Router } from "lucide-react";

import { CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";
import { TimelineWidget } from "@/src/components/TimelineWidget";
import { ApprovalsWidget } from "@/src/components/ApprovalsWidget";
import { RetriesWidget } from "@/src/components/RetriesWidget";
import { MemoryWidget } from "@/src/components/MemoryWidget";
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

export function DashboardClient({ initialRuntime, recentTimelineEvents = [], approvalsPendingCount = 0, approvalsOldest = null, retriesFailedCount = 0, retriesMostRecent = null, memoryStats }: { initialRuntime: DashboardRuntimeStateDto; recentTimelineEvents?: TimelineEvent[]; approvalsPendingCount?: number; approvalsOldest?: Approval | null; retriesFailedCount?: number; retriesMostRecent?: RetryEntry | null; memoryStats?: MemoryStats }) {
  const { snapshot, runtimeMeta } = useDashboardRuntime({
    initialRuntime,
    cursorStorageKey: CURSOR_STORAGE_KEY,
  });

  const { metrics, agents, queueLanes, tokenRows, routes, alerts, recentLogs, hasLogs } = useDashboardViewModel(snapshot);

  return (
    <main className="dashboard-shell space-y-6">
      <SectionHeader
        title="Mission Control"
        description={`Keyboard-first operations view with routing, cost, and execution health in one surface. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            <span>Jump: ⌘K · Actions: ?</span>
          </div>
        }
      />

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} {...metric} className="accent-glow" />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.35fr_1fr]">
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

        <Panel title="Task queue snapshot" description="Current lane pressure and expected completion windows.">
          <div className="space-y-2">
            {queueLanes.map((lane) => (
              <div key={lane.lane} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{lane.label}</span>
                <span className="text-muted-foreground">{lane.stateLabel}</span>
                <span className="text-muted-foreground">{lane.summaryLabel}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.05fr]">
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
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1fr_1fr]">
        <TimelineWidget events={recentTimelineEvents} />
        <ApprovalsWidget pendingCount={approvalsPendingCount} oldest={approvalsOldest} />
        <RetriesWidget failedCount={retriesFailedCount} mostRecent={retriesMostRecent} />
        {memoryStats && <MemoryWidget stats={memoryStats} />}

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
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <Bot className="h-3.5 w-3.5" />Focus active agent
              </span>
              <span className="text-muted-foreground">A</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <ListTodo className="h-3.5 w-3.5" />Open blocked queue lane
              </span>
              <span className="text-muted-foreground">Q</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <Cpu className="h-3.5 w-3.5" />Inspect model fallback
              </span>
              <span className="text-muted-foreground">M</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <DollarSign className="h-3.5 w-3.5" />Open cost analyzer
              </span>
              <span className="text-muted-foreground">C</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <Clock3 className="h-3.5 w-3.5" />Stale task triage
              </span>
              <span className="text-muted-foreground">T</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2">
                <ArrowUpRight className="h-3.5 w-3.5" />Escalate to primary
              </span>
              <span className="text-muted-foreground">E</span>
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

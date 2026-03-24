import type React from "react";

import { AlertTriangle, ArrowUpRight, Bot, Clock3, Command, Cpu, DollarSign, Layers3, ListTodo, Router } from "lucide-react";

import { CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";
import { getDashboardSnapshot } from "@/src/runtime/dashboard/adapters";
import type { AgentHealth, AlertSeverity } from "@/src/runtime/dashboard/types";

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" | "critical" }) {
  const toneClass =
    tone === "critical"
      ? "bg-destructive/15 text-destructive border-destructive/35"
      : tone === "warning"
        ? "bg-amber-400/10 text-amber-200 border-amber-400/30"
        : "bg-muted/50 text-muted-foreground border-border";

  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

function healthToTone(health: AgentHealth): "default" | "warning" {
  return health === "degraded" ? "warning" : "default";
}

function severityToTone(severity: AlertSeverity): "warning" | "critical" {
  return severity;
}

function formatTokens(value: number) {
  return `${Math.round(value / 1000)}k`;
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)}`;
}

function formatLatency(ms: number) {
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatEta(minutes: number | null) {
  return minutes == null ? "unknown" : `~${minutes}m`;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export default async function Home() {
  const snapshot = await getDashboardSnapshot();

  const runningTasks = snapshot.queueSnapshot.filter((lane) => lane.lane !== "blocked").reduce((sum, lane) => sum + lane.count, 0);
  const waitingReview = snapshot.queueSnapshot.find((lane) => lane.lane === "review")?.count ?? 0;
  const criticalAlerts = snapshot.alerts.filter((alert) => alert.severity === "critical").length;
  const warningAlerts = snapshot.alerts.filter((alert) => alert.severity === "warning").length;

  const metrics = [
    {
      label: "Active agents",
      value: String(snapshot.activeAgents.length).padStart(2, "0"),
      delta: `${snapshot.activeAgents.filter((agent) => agent.health === "busy").length} busy now`,
    },
    { label: "Running tasks", value: String(runningTasks), delta: `${waitingReview} waiting review` },
    {
      label: "Token burn",
      value: formatTokens(snapshot.tokenCostSummary.inputTokens + snapshot.tokenCostSummary.outputTokens),
      delta: `${formatUsd(snapshot.tokenCostSummary.totalCostUsd)} today`,
    },
    { label: "Alerts", value: String(snapshot.alerts.length).padStart(2, "0"), delta: `${criticalAlerts} critical, ${warningAlerts} warning` },
  ];

  return (
    <main className="dashboard-shell space-y-6">
      <SectionHeader
        title="Mission Control"
        description={`Keyboard-first operations view with routing, cost, and execution health in one surface. Source: ${snapshot.source}.`}
        action={
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Command className="h-3.5 w-3.5" />
            <span>Jump: ⌘K</span>
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
            {snapshot.activeAgents.map((agent) => (
              <div key={agent.id} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{agent.name}</div>
                  <div className="truncate text-muted-foreground">{agent.role}</div>
                </div>
                <Badge tone={healthToTone(agent.health)}>{titleCase(agent.health)}</Badge>
                <div className="text-muted-foreground">{agent.model}</div>
                <div className="text-muted-foreground">Q {agent.queueDepth}</div>
                <div className="text-right text-muted-foreground">{formatLatency(agent.medianLatencyMs)}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Task queue snapshot" description="Current lane pressure and expected completion windows.">
          <div className="space-y-2">
            {snapshot.queueSnapshot.map((lane) => (
              <div key={lane.lane} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{lane.label}</span>
                <span className="text-muted-foreground">{lane.stateLabel}</span>
                <span className="text-muted-foreground">
                  {lane.count} · {formatEta(lane.etaMinutes)}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.05fr]">
        <Panel title="Token & cost summary" description="Usage and spend trend for this session window.">
          <div className="space-y-2">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Input tokens</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{formatTokens(snapshot.tokenCostSummary.inputTokens)}</div>
                <div className="text-muted-foreground">+{snapshot.tokenCostSummary.inputDeltaPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Output tokens</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{formatTokens(snapshot.tokenCostSummary.outputTokens)}</div>
                <div className="text-muted-foreground">+{snapshot.tokenCostSummary.outputDeltaPct.toFixed(1)}%</div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Total cost</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{formatUsd(snapshot.tokenCostSummary.totalCostUsd)}</div>
                <div className="text-muted-foreground">+{formatUsd(snapshot.tokenCostSummary.costDeltaUsd)}</div>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Projected day-end</span>
              <div className="text-right">
                <div className="font-medium text-foreground">{formatUsd(snapshot.tokenCostSummary.projectedDayEndUsd)}</div>
                <div className="text-muted-foreground">{snapshot.tokenCostSummary.withinBudget ? "within budget" : "over budget"}</div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Model routing summary" description="Live traffic split across active model providers.">
          <div className="space-y-2">
            {snapshot.modelRouting.map((route) => (
              <div key={route.model} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <Router className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{route.model}</div>
                  <div className="text-muted-foreground">{route.role}</div>
                </div>
                <span className="text-muted-foreground">{route.sharePct}%</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Alerts / stuck tasks" description="Priority issues requiring operator action.">
          <div className="space-y-2">
            {snapshot.alerts.map((alert) => (
              <div key={alert.id} className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                    {alert.title}
                  </div>
                  <Badge tone={severityToTone(alert.severity)}>{alert.severity}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">{alert.detail}</p>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1.7fr_1fr]">
        <Panel title="Recent logs" description="Latest execution and orchestration events from runtime.">
          <div className="space-y-2 font-mono text-xs">
            {snapshot.recentLogs.map((entry) => (
              <div key={entry.id} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
                {entry.message}
              </div>
            ))}
          </div>
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

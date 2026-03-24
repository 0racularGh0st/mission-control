import type React from "react";

import { AlertTriangle, ArrowUpRight, Bot, Clock3, Command, Cpu, DollarSign, Layers3, ListTodo, Router } from "lucide-react";

import { CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";

const metrics = [
  { label: "Active agents", value: "07", delta: "+2 in last hour" },
  { label: "Running tasks", value: "19", delta: "5 waiting review" },
  { label: "Token burn", value: "241k", delta: "$4.82 today" },
  { label: "Alerts", value: "03", delta: "1 critical, 2 warning" },
];

const activeAgents = [
  { name: "Planner", role: "Router", status: "Healthy", model: "gpt-5.4", queue: 4, latency: "1.3s" },
  { name: "Coder", role: "Execution", status: "Busy", model: "gpt-5.3-codex", queue: 7, latency: "2.8s" },
  { name: "Research", role: "Search", status: "Healthy", model: "gpt-4.1", queue: 3, latency: "1.9s" },
  { name: "Ops", role: "Infra", status: "Degraded", model: "o3", queue: 5, latency: "4.7s" },
];

const queueSnapshot = [
  { lane: "Now", count: 6, eta: "~14m", state: "In progress" },
  { lane: "Next", count: 8, eta: "~31m", state: "Queued" },
  { lane: "Blocked", count: 3, eta: "unknown", state: "Needs input" },
  { lane: "Review", count: 2, eta: "~9m", state: "Pending approval" },
];

const tokenSummary = [
  { label: "Input tokens", value: "164k", trend: "+8.2%" },
  { label: "Output tokens", value: "77k", trend: "+3.7%" },
  { label: "Total cost", value: "$4.82", trend: "+$0.71" },
  { label: "Projected day-end", value: "$8.10", trend: "within budget" },
];

const modelRouting = [
  { model: "gpt-5.4", share: "42%", kind: "Planner / synthesis" },
  { model: "gpt-5.3-codex", share: "31%", kind: "Coding tickets" },
  { model: "o3", share: "17%", kind: "Reasoning / fallback" },
  { model: "gpt-4.1", share: "10%", kind: "Fast support" },
];

const recentLogs = [
  "16:42 Scheduler: Task T-584 promoted to NOW lane.",
  "16:39 Coder: Ticket 4 merged on main (lint/build clean).",
  "16:33 Router: switched low-risk requests to gpt-4.1.",
  "16:28 Ops: retrying stale worker session mc-node-03.",
  "16:20 Planner: created handoff note for Ticket 5.",
];

const alerts = [
  { title: "Stuck task T-571", detail: "No heartbeat for 11m on ops lane", severity: "critical" },
  { title: "Model fallback spike", detail: "o3 fallback +12% in last 30m", severity: "warning" },
  { title: "Budget watch", detail: "Projected daily spend crossed soft cap", severity: "warning" },
];

function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: "default" | "warning" | "critical" }) {
  const toneClass =
    tone === "critical"
      ? "bg-destructive/15 text-destructive border-destructive/35"
      : tone === "warning"
        ? "bg-amber-400/10 text-amber-200 border-amber-400/30"
        : "bg-muted/50 text-muted-foreground border-border";

  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium ${toneClass}`}>{children}</span>;
}

export default function Home() {
  return (
    <main className="dashboard-shell space-y-6">
      <SectionHeader
        title="Mission Control"
        description="Keyboard-first operations view with routing, cost, and execution health in one surface."
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
            {activeAgents.map((agent) => (
              <div key={agent.name} className="grid grid-cols-[minmax(0,1.2fr)_auto_auto_auto_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <div className="min-w-0">
                  <div className="truncate font-medium text-foreground">{agent.name}</div>
                  <div className="truncate text-muted-foreground">{agent.role}</div>
                </div>
                <Badge tone={agent.status === "Degraded" ? "warning" : "default"}>{agent.status}</Badge>
                <div className="text-muted-foreground">{agent.model}</div>
                <div className="text-muted-foreground">Q {agent.queue}</div>
                <div className="text-right text-muted-foreground">{agent.latency}</div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Task queue snapshot" description="Current lane pressure and expected completion windows.">
          <div className="space-y-2">
            {queueSnapshot.map((lane) => (
              <div key={lane.lane} className="grid grid-cols-[auto_auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <Layers3 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-medium">{lane.lane}</span>
                <span className="text-muted-foreground">{lane.state}</span>
                <span className="text-muted-foreground">{lane.count} · {lane.eta}</span>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <section className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr_1.05fr]">
        <Panel title="Token & cost summary" description="Usage and spend trend for this session window.">
          <div className="space-y-2">
            {tokenSummary.map((item) => (
              <div key={item.label} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <span className="text-muted-foreground">{item.label}</span>
                <div className="text-right">
                  <div className="font-medium text-foreground">{item.value}</div>
                  <div className="text-muted-foreground">{item.trend}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Model routing summary" description="Live traffic split across active model providers.">
          <div className="space-y-2">
            {modelRouting.map((route) => (
              <div key={route.model} className="grid grid-cols-[auto_1fr_auto] items-center gap-2 rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-xs">
                <Router className="h-3.5 w-3.5 text-muted-foreground" />
                <div>
                  <div className="font-medium">{route.model}</div>
                  <div className="text-muted-foreground">{route.kind}</div>
                </div>
                <span className="text-muted-foreground">{route.share}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Alerts / stuck tasks" description="Priority issues requiring operator action.">
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div key={alert.title} className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-1.5 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-200" />
                    {alert.title}
                  </div>
                  <Badge tone={alert.severity === "critical" ? "critical" : "warning"}>{alert.severity}</Badge>
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
            {recentLogs.map((line) => (
              <div key={line} className="rounded-md border border-border/60 bg-background/35 px-3 py-2 text-muted-foreground">
                {line}
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <CardTitle className="mb-1">Operator quick actions</CardTitle>
          <CardDescription className="mb-4">Fast keyboard-centric controls for common interventions.</CardDescription>
          <div className="space-y-2 text-xs">
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><Bot className="h-3.5 w-3.5" />Focus active agent</span>
              <span className="text-muted-foreground">A</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><ListTodo className="h-3.5 w-3.5" />Open blocked queue lane</span>
              <span className="text-muted-foreground">Q</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><Cpu className="h-3.5 w-3.5" />Inspect model fallback</span>
              <span className="text-muted-foreground">M</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><DollarSign className="h-3.5 w-3.5" />Open cost analyzer</span>
              <span className="text-muted-foreground">C</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><Clock3 className="h-3.5 w-3.5" />Stale task triage</span>
              <span className="text-muted-foreground">T</span>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2">
              <span className="flex items-center gap-2"><ArrowUpRight className="h-3.5 w-3.5" />Escalate to primary</span>
              <span className="text-muted-foreground">E</span>
            </div>
          </div>
        </Panel>
      </section>
    </main>
  );
}

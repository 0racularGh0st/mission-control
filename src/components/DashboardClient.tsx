"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { AlertTriangle, ArrowUpRight, Bot, Clock3, Command, Cpu, DollarSign, Layers3, ListTodo, Router } from "lucide-react";

import { CardDescription, CardTitle } from "@/components/ui/card";
import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";
import type {
  AgentHealth,
  AlertSeverity,
  DashboardIncrementalPatchDto,
  DashboardRuntimeStateDto,
  DashboardSnapshotDto,
} from "@/src/runtime/dashboard/types";

const CURSOR_STORAGE_KEY = "mission-control.dashboard.cursor";
const MAX_LOGS = 40;

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

function applyPatch(snapshot: DashboardSnapshotDto, patch: DashboardIncrementalPatchDto): DashboardSnapshotDto {
  if (patch.type === "log.append") {
    const incoming = patch.logs ?? [];
    if (incoming.length === 0) {
      return snapshot;
    }

    const merged = [...snapshot.recentLogs, ...incoming];
    const deduped = Array.from(new Map(merged.map((log) => [log.id, log])).values());

    return {
      ...snapshot,
      generatedAtIso: patch.emittedAtIso,
      recentLogs: deduped.slice(-MAX_LOGS),
    };
  }

  if (patch.type === "alert.upsert" && patch.alert) {
    const existingIndex = snapshot.alerts.findIndex((alert) => alert.id === patch.alert?.id);
    const alerts = [...snapshot.alerts];

    if (existingIndex >= 0) {
      alerts[existingIndex] = patch.alert;
    } else {
      alerts.unshift(patch.alert);
    }

    return {
      ...snapshot,
      generatedAtIso: patch.emittedAtIso,
      alerts,
    };
  }

  if (patch.type === "queue.lane" && patch.queueLane) {
    const lanes = [...snapshot.queueSnapshot];
    const existingIndex = lanes.findIndex((lane) => lane.lane === patch.queueLane?.lane);

    if (existingIndex >= 0) {
      lanes[existingIndex] = patch.queueLane;
    } else {
      lanes.push(patch.queueLane);
    }

    return {
      ...snapshot,
      generatedAtIso: patch.emittedAtIso,
      queueSnapshot: lanes,
    };
  }

  return snapshot;
}

async function fetchRuntime(cursor?: string): Promise<DashboardRuntimeStateDto> {
  const query = cursor ? `?cursor=${encodeURIComponent(cursor)}` : "";
  const response = await fetch(`/api/runtime/dashboard${query}`, {
    method: "GET",
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`runtime-fetch-failed-${response.status}`);
  }

  return (await response.json()) as DashboardRuntimeStateDto;
}

export function DashboardClient({ initialRuntime }: { initialRuntime: DashboardRuntimeStateDto }) {
  const [snapshot, setSnapshot] = useState(initialRuntime.snapshot);
  const [runtimeMeta, setRuntimeMeta] = useState({
    source: initialRuntime.source,
    transport: initialRuntime.transport,
    recommendedPollMs: initialRuntime.recommendedPollMs,
    incrementalSupported: initialRuntime.incrementalSupported,
    ssePath: initialRuntime.ssePath,
  });

  const cursorRef = useRef(initialRuntime.cursor);

  useEffect(() => {
    try {
      const persisted = window.localStorage.getItem(CURSOR_STORAGE_KEY);
      if (persisted) {
        cursorRef.current = persisted;
      }
    } catch {
      // ignore storage failures
    }
  }, []);

  useEffect(() => {
    const persistCursor = (cursor: string) => {
      cursorRef.current = cursor;
      try {
        window.localStorage.setItem(CURSOR_STORAGE_KEY, cursor);
      } catch {
        // ignore storage failures
      }
    };

    const pollOnce = async () => {
      const runtime = await fetchRuntime(cursorRef.current);
      setRuntimeMeta({
        source: runtime.source,
        transport: runtime.transport,
        recommendedPollMs: runtime.recommendedPollMs,
        incrementalSupported: runtime.incrementalSupported,
        ssePath: runtime.ssePath,
      });

      if (!runtime.incrementalSupported || runtime.updates.length === 0) {
        setSnapshot(runtime.snapshot);
      } else {
        setSnapshot((prev) => runtime.updates.reduce((acc, patch) => applyPatch(acc, patch), prev));
      }

      persistCursor(runtime.cursor);
    };

    if (runtimeMeta.incrementalSupported && runtimeMeta.ssePath) {
      const streamUrl = new URL(runtimeMeta.ssePath, window.location.origin);
      if (cursorRef.current) {
        streamUrl.searchParams.set("cursor", cursorRef.current);
      }

      const source = new EventSource(streamUrl.toString());

      source.addEventListener("snapshot", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          cursor: string;
          source: DashboardRuntimeStateDto["source"];
          transport: DashboardRuntimeStateDto["transport"];
          snapshot: DashboardSnapshotDto;
        };

        setSnapshot(payload.snapshot);
        setRuntimeMeta((prev) => ({ ...prev, source: payload.source, transport: payload.transport }));
        persistCursor(payload.cursor);
      });

      source.addEventListener("patch", (event) => {
        const patch = JSON.parse((event as MessageEvent<string>).data) as DashboardIncrementalPatchDto;
        setSnapshot((prev) => applyPatch(prev, patch));
        persistCursor(patch.cursor);
      });

      source.addEventListener("runtime", (event) => {
        const payload = JSON.parse((event as MessageEvent<string>).data) as {
          cursor: string;
          source: DashboardRuntimeStateDto["source"];
          transport: DashboardRuntimeStateDto["transport"];
          recommendedPollMs?: number;
        };

        setRuntimeMeta((prev) => ({
          ...prev,
          source: payload.source,
          transport: payload.transport,
          recommendedPollMs: payload.recommendedPollMs ?? prev.recommendedPollMs,
        }));
        persistCursor(payload.cursor);
      });

      source.addEventListener("error", () => {
        void pollOnce();
      });

      return () => {
        source.close();
      };
    }

    const interval = window.setInterval(() => {
      void pollOnce();
    }, runtimeMeta.recommendedPollMs);

    void pollOnce();

    return () => {
      window.clearInterval(interval);
    };
  }, [runtimeMeta.incrementalSupported, runtimeMeta.recommendedPollMs, runtimeMeta.ssePath]);

  const runningTasks = useMemo(
    () => snapshot.queueSnapshot.filter((lane) => lane.lane !== "blocked").reduce((sum, lane) => sum + lane.count, 0),
    [snapshot.queueSnapshot],
  );
  const waitingReview = useMemo(() => snapshot.queueSnapshot.find((lane) => lane.lane === "review")?.count ?? 0, [snapshot.queueSnapshot]);
  const criticalAlerts = useMemo(() => snapshot.alerts.filter((alert) => alert.severity === "critical").length, [snapshot.alerts]);
  const warningAlerts = useMemo(() => snapshot.alerts.filter((alert) => alert.severity === "warning").length, [snapshot.alerts]);

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
        description={`Keyboard-first operations view with routing, cost, and execution health in one surface. Source: ${runtimeMeta.source} · transport: ${runtimeMeta.transport}.`}
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

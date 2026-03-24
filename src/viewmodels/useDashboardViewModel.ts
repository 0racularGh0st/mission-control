import { useMemo } from "react";

import type { DashboardSnapshotDto } from "@/src/runtime/dashboard/types";

export type BadgeTone = "default" | "warning" | "critical";

export interface DashboardMetricViewModel {
  label: string;
  value: string;
  delta: string;
}

export interface DashboardAgentViewModel {
  id: string;
  name: string;
  role: string;
  healthLabel: string;
  healthTone: "default" | "warning";
  model: string;
  queueDepthLabel: string;
  latencyLabel: string;
}

export interface DashboardQueueLaneViewModel {
  lane: string;
  label: string;
  stateLabel: string;
  summaryLabel: string;
}

export interface DashboardTokenRowViewModel {
  label: string;
  valueLabel: string;
  deltaLabel: string;
}

export interface DashboardRouteViewModel {
  model: string;
  role: string;
  shareLabel: string;
}

export interface DashboardAlertViewModel {
  id: string;
  title: string;
  detail: string;
  severityLabel: string;
  severityTone: "warning" | "critical";
}

export interface DashboardLogItemViewModel {
  id: string;
  message: string;
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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

export function useDashboardViewModel(snapshot: DashboardSnapshotDto) {
  return useMemo(() => {
    const busyAgents = snapshot.activeAgents.filter((agent) => agent.health === "busy").length;
    const blockedTasks = snapshot.queueSnapshot.find((lane) => lane.lane === "blocked")?.count ?? 0;
    const waitingReview = snapshot.queueSnapshot.find((lane) => lane.lane === "review")?.count ?? 0;
    const runningTasks = snapshot.queueSnapshot.reduce((sum, lane) => sum + lane.count, 0) - blockedTasks;
    const criticalAlerts = snapshot.alerts.filter((alert) => alert.severity === "critical").length;
    const warningAlerts = snapshot.alerts.filter((alert) => alert.severity === "warning").length;

    const metrics: DashboardMetricViewModel[] = [
      {
        label: "Active agents",
        value: String(snapshot.activeAgents.length).padStart(2, "0"),
        delta: `${busyAgents} busy now`,
      },
      {
        label: "Running tasks",
        value: String(runningTasks),
        delta: `${waitingReview} waiting review`,
      },
      {
        label: "Token burn",
        value: formatTokens(snapshot.tokenCostSummary.inputTokens + snapshot.tokenCostSummary.outputTokens),
        delta: `${formatUsd(snapshot.tokenCostSummary.totalCostUsd)} today`,
      },
      {
        label: "Alerts",
        value: String(snapshot.alerts.length).padStart(2, "0"),
        delta: `${criticalAlerts} critical, ${warningAlerts} warning`,
      },
    ];

    const agents: DashboardAgentViewModel[] = snapshot.activeAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.role,
      healthLabel: titleCase(agent.health),
      healthTone: agent.health === "degraded" ? "warning" : "default",
      model: agent.model,
      queueDepthLabel: `Q ${agent.queueDepth}`,
      latencyLabel: formatLatency(agent.medianLatencyMs),
    }));

    const queueLanes: DashboardQueueLaneViewModel[] = snapshot.queueSnapshot.map((lane) => ({
      lane: lane.lane,
      label: lane.label,
      stateLabel: lane.stateLabel,
      summaryLabel: `${lane.count} · ${formatEta(lane.etaMinutes)}`,
    }));

    const tokenRows: DashboardTokenRowViewModel[] = [
      {
        label: "Input tokens",
        valueLabel: formatTokens(snapshot.tokenCostSummary.inputTokens),
        deltaLabel: `+${snapshot.tokenCostSummary.inputDeltaPct.toFixed(1)}%`,
      },
      {
        label: "Output tokens",
        valueLabel: formatTokens(snapshot.tokenCostSummary.outputTokens),
        deltaLabel: `+${snapshot.tokenCostSummary.outputDeltaPct.toFixed(1)}%`,
      },
      {
        label: "Total cost",
        valueLabel: formatUsd(snapshot.tokenCostSummary.totalCostUsd),
        deltaLabel: `+${formatUsd(snapshot.tokenCostSummary.costDeltaUsd)}`,
      },
      {
        label: "Projected day-end",
        valueLabel: formatUsd(snapshot.tokenCostSummary.projectedDayEndUsd),
        deltaLabel: snapshot.tokenCostSummary.withinBudget ? "within budget" : "over budget",
      },
    ];

    const routes: DashboardRouteViewModel[] = snapshot.modelRouting.map((route) => ({
      model: route.model,
      role: route.role,
      shareLabel: `${route.sharePct}%`,
    }));

    const alerts: DashboardAlertViewModel[] = snapshot.alerts.map((alert) => ({
      id: alert.id,
      title: alert.title,
      detail: alert.detail,
      severityLabel: alert.severity,
      severityTone: alert.severity,
    }));

    const recentLogs: DashboardLogItemViewModel[] = snapshot.recentLogs.map((entry) => ({
      id: entry.id,
      message: entry.message,
    }));

    return {
      metrics,
      agents,
      queueLanes,
      tokenRows,
      routes,
      alerts,
      recentLogs,
      hasLogs: recentLogs.length > 0,
    };
  }, [snapshot]);
}

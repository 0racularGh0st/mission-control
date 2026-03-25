"use client";

import { useEffect, useMemo, useState } from "react";

import { Panel, SectionHeader } from "@/src/components/primitives";
import type { OpenAIAdminReportingDto } from "@/src/runtime/openaiReporting/types";

type MiniMaxCostTrend = {
  date: string;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
};

type MiniMaxReportingDto = {
  source: "live" | "mock";
  generatedAt: string;
  balanceUsd: number;
  todayUsageUsd: number;
  todayInputTokens: number;
  todayOutputTokens: number;
  trends7d: MiniMaxCostTrend[];
  costPerModel: { model: string; costUsd: number; sharePct: number }[];
  notes: string[];
};

type CostsState = {
  loading: boolean;
  error: string | null;
  minimaxReport: MiniMaxReportingDto | null;
  openaiReport: OpenAIAdminReportingDto | null;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTokens(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function asciiBarChart(values: number[], labels: string[], maxWidth = 20): string[] {
  if (values.length === 0) return [];
  const max = Math.max(...values, 0.01);
  return values.map((v, i) => {
    const barLen = Math.round((v / max) * maxWidth);
    const bar = "█".repeat(barLen);
    const label = labels[i] ?? "";
    return `${label.padEnd(10)} ${bar} ${formatUsd(v)}`;
  });
}

function CostTrendChart({ trends }: { trends: MiniMaxCostTrend[] }) {
  const lines = useMemo(() => {
    const costs = trends.map((t) => t.costUsd);
    const dates = trends.map((t) => t.date.slice(5)); // MM-DD
    return asciiBarChart(costs, dates, 18);
  }, [trends]);

  if (trends.length === 0) {
    return <div className="text-xs text-muted-foreground">No trend data available.</div>;
  }

  return (
    <div className="space-y-3">
      <div className="text-xs font-medium text-muted-foreground uppercase tracking-wide">7-day cost trend</div>
      <div className="font-mono text-xs space-y-1">
        {lines.map((line, i) => (
          <div key={i} className="text-emerald-300/80">{line}</div>
        ))}
      </div>
    </div>
  );
}

function TokenBarChart({ inputTokens, outputTokens }: { inputTokens: number; outputTokens: number }) {
  const max = Math.max(inputTokens, outputTokens, 1);
  const inputBar = Math.round((inputTokens / max) * 20);
  const outputBar = Math.round((outputTokens / max) * 20);

  return (
    <div className="space-y-2">
      <div className="text-xs font-mono">
        <span className="text-sky-400">IN </span>
        {"█".repeat(inputBar).padEnd(20)} {formatTokens(inputTokens)}
      </div>
      <div className="text-xs font-mono">
        <span className="text-violet-400">OUT</span>
        {"█".repeat(outputBar).padEnd(20)} {formatTokens(outputTokens)}
      </div>
    </div>
  );
}

export function CostsClient() {
  const [state, setState] = useState<CostsState>({
    loading: true,
    error: null,
    minimaxReport: null,
    openaiReport: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      try {
        // Fetch both MiniMax costs and OpenAI reporting
        const [minimaxRes, openaiRes] = await Promise.all([
          fetch("/api/costs", { cache: "no-store" }),
          fetch("/api/openai/reporting", { cache: "no-store" }),
        ]);

        const [minimaxData, openaiData] = await Promise.all([
          minimaxRes.json() as Promise<MiniMaxReportingDto>,
          openaiRes.json() as Promise<OpenAIAdminReportingDto>,
        ]);

        if (!isCancelled) {
          setState({
            loading: false,
            error: null,
            minimaxReport: minimaxData,
            openaiReport: openaiData,
          });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({
            loading: false,
            error: String(error),
            minimaxReport: null,
            openaiReport: null,
          });
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, []);

  const { minimaxReport, openaiReport } = state;

  const openaiNotes = openaiReport?.notes ?? [];
  const minimaxNotes = minimaxReport?.notes ?? [];

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Costs"
        description="MiniMax platform costs with 7-day trend. OpenAI admin usage also shown."
      />

      {state.loading && <div className="text-sm text-muted-foreground">Loading cost data…</div>}
      {state.error && <div className="text-sm text-red-400">Error: {state.error}</div>}

      {/* MiniMax Summary */}
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="MiniMax Balance">
          {minimaxReport ? (
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{minimaxReport.balanceUsd > 0 ? formatUsd(minimaxReport.balanceUsd) : "—"}</div>
              <div className="text-xs text-muted-foreground">
                {minimaxReport.source === "live" ? "Live from API" : "Estimate only"}
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">{state.loading ? "Loading…" : "No data"}</div>
          )}
        </Panel>

        <Panel title="Today's Usage">
          {minimaxReport ? (
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{formatUsd(minimaxReport.todayUsageUsd)}</div>
              <div className="text-xs text-muted-foreground">{minimaxReport.source}</div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">{state.loading ? "Loading…" : "No data"}</div>
          )}
        </Panel>

        <Panel title="Input Tokens (today)">
          {minimaxReport ? (
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{formatTokens(minimaxReport.todayInputTokens)}</div>
              <div className="text-xs text-muted-foreground">tokens consumed</div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">{state.loading ? "Loading…" : "No data"}</div>
          )}
        </Panel>

        <Panel title="Output Tokens (today)">
          {minimaxReport ? (
            <div className="space-y-1">
              <div className="text-2xl font-semibold">{formatTokens(minimaxReport.todayOutputTokens)}</div>
              <div className="text-xs text-muted-foreground">tokens generated</div>
            </div>
          ) : (
            <div className="text-muted-foreground text-sm">{state.loading ? "Loading…" : "No data"}</div>
          )}
        </Panel>
      </section>

      {/* 7-day Trend Chart */}
      {minimaxReport && (
        <Panel title="7-Day Trend" description="Daily spend bar chart (ASCII).">
          <CostTrendChart trends={minimaxReport.trends7d} />
        </Panel>
      )}

      {/* Token Breakdown */}
      {minimaxReport && (
        <Panel title="Token Breakdown (today)" description="Input vs output tokens.">
          <TokenBarChart inputTokens={minimaxReport.todayInputTokens} outputTokens={minimaxReport.todayOutputTokens} />
        </Panel>
      )}

      {/* Cost per Model */}
      {minimaxReport && minimaxReport.costPerModel.length > 0 && (
        <Panel title="Cost by Model" description="Today's spend breakdown by model.">
          <div className="space-y-2">
            {minimaxReport.costPerModel.map((row) => (
              <div key={row.model} className="flex items-center justify-between rounded-lg border border-border/60 bg-background/35 px-3 py-2 text-sm">
                <span className="font-medium">{row.model}</span>
                <div className="text-right">
                  <div className="font-medium">{formatUsd(row.costUsd)}</div>
                  <div className="text-xs text-muted-foreground">{row.sharePct}% of spend</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* OpenAI Reporting (existing) */}
      {openaiReport && (
        <Panel title="OpenAI Admin (30d)" description="Separate OpenAI org usage/cost rollup.">
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                <div className="text-xs text-muted-foreground">Spend (30d)</div>
                <div className="text-lg font-semibold">{formatUsd(openaiReport.totals.spendUsd)}</div>
              </div>
              <div className="rounded-lg border border-border/60 bg-background/35 px-3 py-2">
                <div className="text-xs text-muted-foreground">Requests</div>
                <div className="text-lg font-semibold">{openaiReport.totals.requests.toLocaleString()}</div>
              </div>
            </div>
            <div className="text-xs text-muted">
              Source: {openaiReport.source} · Generated: {new Date(openaiReport.generatedAt).toLocaleTimeString()}
            </div>
          </div>
        </Panel>
      )}

      {/* Notes */}
      {(minimaxNotes.length > 0 || openaiNotes.length > 0) && (
        <Panel title="Diagnostics">
          <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
            {[...minimaxNotes, ...openaiNotes].map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}

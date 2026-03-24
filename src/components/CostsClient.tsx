"use client";

import { useEffect, useMemo, useState } from "react";

import { MetricCard, Panel, SectionHeader } from "@/src/components/primitives";
import type { OpenAIAdminReportingDto } from "@/src/runtime/openaiReporting/types";

type ReportingState = {
  loading: boolean;
  error: string | null;
  report: OpenAIAdminReportingDto | null;
};

function formatUsd(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatInteger(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value);
}

export function CostsClient() {
  const [state, setState] = useState<ReportingState>({
    loading: true,
    error: null,
    report: null,
  });

  useEffect(() => {
    let isCancelled = false;

    const run = async () => {
      try {
        const response = await fetch("/api/openai/reporting", { method: "GET", cache: "no-store" });
        const payload = (await response.json()) as OpenAIAdminReportingDto;

        if (!isCancelled) {
          setState({ loading: false, error: null, report: payload });
        }
      } catch (error) {
        if (!isCancelled) {
          setState({ loading: false, error: String(error), report: null });
        }
      }
    };

    void run();

    return () => {
      isCancelled = true;
    };
  }, []);

  const notes = useMemo(() => state.report?.notes ?? [], [state.report]);

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Costs"
        description="OpenAI admin usage/cost rollup (safe server adapter with fallback when endpoints differ)."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Spend (30d)"
          value={state.report ? formatUsd(state.report.totals.spendUsd) : state.loading ? "Loading…" : "$0.00"}
          delta={state.report ? `Source: ${state.report.source}` : undefined}
        />
        <MetricCard
          label="Input tokens"
          value={state.report ? formatInteger(state.report.totals.inputTokens) : state.loading ? "Loading…" : "0"}
        />
        <MetricCard
          label="Output tokens"
          value={state.report ? formatInteger(state.report.totals.outputTokens) : state.loading ? "Loading…" : "0"}
        />
        <MetricCard
          label="Model requests"
          value={state.report ? formatInteger(state.report.totals.requests) : state.loading ? "Loading…" : "0"}
        />
      </div>

      <Panel title="Endpoint health" description="Server-side integration status (secrets are never exposed to the browser).">
        {state.error ? <div className="text-sm text-red-400">Failed to load reporting route: {state.error}</div> : null}

        {state.report ? (
          <div className="space-y-2 text-sm">
            <div>
              <strong>Costs:</strong> {state.report.endpoints.costs.ok ? "ok" : "fallback"} (status {state.report.endpoints.costs.status || "n/a"})
            </div>
            <div>
              <strong>Usage:</strong> {state.report.endpoints.usage.ok ? "ok" : "fallback"} (status {state.report.endpoints.usage.status || "n/a"})
            </div>
            <div className="text-muted">Generated: {new Date(state.report.generatedAt).toLocaleString()}</div>
          </div>
        ) : null}
      </Panel>

      {notes.length ? (
        <Panel title="Notes" description="Fallback context and integration diagnostics.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
            {notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  );
}

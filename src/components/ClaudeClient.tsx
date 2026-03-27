"use client";

import { useCallback, useEffect, useState } from "react";

import { Panel, SectionHeader, MetricCard } from "@/src/components/primitives";

interface UsageSummary {
  totalSessions: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCacheRead: number;
  totalCacheCreate: number;
  totalCostUsd: number;
  totalDurationMs: number;
  totalMessages: number;
  byProject: { project: string; sessions: number; costUsd: number; tokens: number }[];
  byModel: { model: string; sessions: number; costUsd: number }[];
}

interface ClaudeSession {
  sessionId: string;
  project: string;
  cwd: string;
  startedAt: string;
  endedAt: string | null;
  entrypoint: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheRead: number;
  cacheCreate: number;
  costUsd: number;
  durationMs: number;
  messageCount: number;
  transcriptPath: string;
  gitBranch: string;
  version: string;
}

function formatUsd(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(value);
}

function formatTokens(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`;
  return String(value);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(0)}s`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(0)}m`;
  return `${(ms / 3_600_000).toFixed(1)}h`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  } catch {
    return iso;
  }
}

function modelShortName(model: string): string {
  if (model.includes("opus")) return "Opus 4.6";
  if (model.includes("sonnet")) return "Sonnet 4.6";
  if (model.includes("haiku")) return "Haiku 4.5";
  return model;
}

export function ClaudeClient() {
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [sessions, setSessions] = useState<ClaudeSession[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 10;

  useEffect(() => {
    async function load() {
      try {
        const [usageRes, sessionsRes] = await Promise.all([
          fetch("/api/claude", { cache: "no-store" }),
          fetch(`/api/claude/sessions?limit=20${projectFilter ? `&project=${encodeURIComponent(projectFilter)}` : ""}`, { cache: "no-store" }),
        ]);

        if (usageRes.ok) {
          const data = await usageRes.json();
          setUsage(data.usage);
        }
        if (sessionsRes.ok) {
          const data = await sessionsRes.json();
          setSessions(data.sessions ?? []);
          setNextCursor(data.nextCursor ?? null);
        }
      } catch {
        // keep previous state
      } finally {
        setLoading(false);
      }
    }
    setLoading(true);
    load();
  }, [projectFilter]);

  // Reset page when filter or sessions change
  useEffect(() => {
    setCurrentPage(1);
  }, [projectFilter]);

  const totalPages = Math.max(1, Math.ceil(sessions.length / PAGE_SIZE));
  const paginatedSessions = sessions.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const url = `/api/claude/sessions?limit=20&cursor=${encodeURIComponent(nextCursor)}${projectFilter ? `&project=${encodeURIComponent(projectFilter)}` : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setSessions((prev) => [...prev, ...(data.sessions ?? [])]);
        setNextCursor(data.nextCursor ?? null);
      }
    } catch {
      // keep previous
    } finally {
      setLoadingMore(false);
    }
  }, [nextCursor, loadingMore, projectFilter]);

  if (loading) {
    return (
      <div className="dashboard-shell">
        <SectionHeader title="Claude Code" description="Loading session data..." />
        <div className="py-12 text-center text-sm text-muted-foreground">Scanning sessions...</div>
      </div>
    );
  }

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Claude Code"
        description="Usage metrics and session history across all Claude Code projects."
      />

      {/* Usage summary cards */}
      {usage && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <MetricCard label="Sessions" value={String(usage.totalSessions)} />
          <MetricCard label="Total Cost" value={formatUsd(usage.totalCostUsd)} />
          <MetricCard label="Output Tokens" value={formatTokens(usage.totalOutputTokens)} />
          <MetricCard label="Messages" value={String(usage.totalMessages)} />
        </div>
      )}

      {/* Token breakdown */}
      {usage && (
        <Panel title="Token breakdown" description="All-time token usage across Claude Code sessions.">
          <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
            <div>
              <div className="text-xs text-muted-foreground">Input</div>
              <div className="font-mono text-foreground">{formatTokens(usage.totalInputTokens)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Output</div>
              <div className="font-mono text-foreground">{formatTokens(usage.totalOutputTokens)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cache Read</div>
              <div className="font-mono text-foreground">{formatTokens(usage.totalCacheRead)}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Cache Write</div>
              <div className="font-mono text-foreground">{formatTokens(usage.totalCacheCreate)}</div>
            </div>
          </div>
        </Panel>
      )}

      {/* By project + by model side-by-side */}
      {usage && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <Panel title="By project" description="Session count and cost per project.">
            <div className="space-y-2 text-sm">
              {usage.byProject.map((p) => (
                <div
                  key={p.project}
                  className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-3 py-2 cursor-pointer hover:bg-background/50 transition-colors"
                  onClick={() => setProjectFilter(projectFilter === p.project ? "" : p.project)}
                >
                  <span className={`font-medium ${projectFilter === p.project ? "text-accent" : "text-foreground"}`}>
                    {p.project}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.sessions} sessions · {formatUsd(p.costUsd)} · {formatTokens(p.tokens)} tokens
                  </span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="By model" description="Usage split by Claude model.">
            <div className="space-y-2 text-sm">
              {usage.byModel.map((m) => (
                <div
                  key={m.model}
                  className="flex items-center justify-between rounded border border-border/40 bg-background/30 px-3 py-2"
                >
                  <span className="font-medium text-foreground">{modelShortName(m.model)}</span>
                  <span className="text-xs text-muted-foreground">
                    {m.sessions} sessions · {formatUsd(m.costUsd)}
                  </span>
                </div>
              ))}
              {usage.byModel.length === 0 && (
                <div className="text-muted-foreground text-xs">No model data available.</div>
              )}
            </div>
          </Panel>
        </div>
      )}

      {/* Sessions table */}
      <Panel
        title={`Sessions${projectFilter ? ` — ${projectFilter}` : ""}`}
        description={`${sessions.length} sessions loaded · showing ${PAGE_SIZE} per page.${projectFilter ? " Click project above to clear filter." : ""}`}
      >
        {sessions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No Claude Code sessions found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-left text-xs text-muted-foreground uppercase tracking-wide">
                  <th className="pb-2 pr-4 font-medium">Time</th>
                  <th className="pb-2 pr-4 font-medium">Project</th>
                  <th className="pb-2 pr-4 font-medium">Model</th>
                  <th className="pb-2 pr-4 font-medium">Duration</th>
                  <th className="pb-2 pr-4 font-medium">Messages</th>
                  <th className="pb-2 pr-4 font-medium text-right">Output</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cache</th>
                  <th className="pb-2 pr-4 font-medium text-right">Cost</th>
                  <th className="pb-2 font-medium">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {paginatedSessions.map((s) => (
                  <tr
                    key={s.sessionId}
                    className="text-muted-foreground hover:bg-background/40 transition-colors"
                  >
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                      {formatTime(s.startedAt)}
                    </td>
                    <td className="py-2 pr-4 font-medium text-foreground">
                      {s.project}
                    </td>
                    <td className="py-2 pr-4 text-xs whitespace-nowrap">
                      {modelShortName(s.model)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs whitespace-nowrap">
                      {formatDuration(s.durationMs)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-center">
                      {s.messageCount}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {formatTokens(s.outputTokens)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {formatTokens(s.cacheRead)}
                    </td>
                    <td className="py-2 pr-4 font-mono text-xs text-right whitespace-nowrap">
                      {s.costUsd > 0 ? formatUsd(s.costUsd) : "—"}
                    </td>
                    <td className="py-2 text-xs whitespace-nowrap">
                      <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
                        s.entrypoint.includes("vscode")
                          ? "border-blue-500/30 bg-blue-500/20 text-blue-400"
                          : s.entrypoint.includes("sdk")
                            ? "border-purple-500/30 bg-purple-500/20 text-purple-400"
                            : "border-emerald-500/30 bg-emerald-500/20 text-emerald-400"
                      }`}>
                        {s.entrypoint.replace("claude-", "")}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination controls */}
        {sessions.length > 0 && (
          <div className="mt-4 flex items-center justify-center gap-1">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="rounded border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Prev
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((page) => {
                // Show first, last, current, and neighbors
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .reduce<(number | "ellipsis")[]>((acc, page, idx, arr) => {
                if (idx > 0 && arr[idx - 1] !== page - 1) acc.push("ellipsis");
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) =>
                item === "ellipsis" ? (
                  <span key={`ellipsis-${idx}`} className="px-1 text-xs text-muted-foreground">
                    ...
                  </span>
                ) : (
                  <button
                    key={item}
                    onClick={() => setCurrentPage(item)}
                    className={`rounded border px-3 py-1.5 text-xs transition-colors ${
                      currentPage === item
                        ? "border-accent/60 bg-accent/20 text-accent font-medium"
                        : "border-border/60 bg-background/40 text-muted-foreground hover:bg-background/60 hover:text-foreground"
                    }`}
                  >
                    {item}
                  </button>
                )
              )}

            <button
              onClick={() => {
                if (currentPage === totalPages && nextCursor) {
                  loadMore().then(() => setCurrentPage((p) => p + 1));
                } else {
                  setCurrentPage((p) => Math.min(totalPages, p + 1));
                }
              }}
              disabled={currentPage === totalPages && !nextCursor}
              className="rounded border border-border/60 bg-background/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-background/60 hover:text-foreground transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              {currentPage === totalPages && nextCursor ? (loadingMore ? "Loading..." : "Next") : "Next"}
            </button>
          </div>
        )}

        {/* Page info */}
        {sessions.length > 0 && (
          <div className="mt-2 text-center text-xs text-muted-foreground">
            Page {currentPage} of {totalPages} · {sessions.length} sessions{nextCursor ? " (more available)" : ""}
          </div>
        )}
      </Panel>
    </div>
  );
}

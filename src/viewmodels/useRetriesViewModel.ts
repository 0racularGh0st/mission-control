"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { RetryEntry, RetrySource, RetryStatus } from "@/src/types/retries";
import type { RetryEvent } from "@/src/runtime/retries/eventsBus";

const PAGE_SIZE = 50;

interface RetriesState {
  retries: RetryEntry[];
  statusFilter: RetryStatus | null;
  sourceFilter: RetrySource | null;
  failedCount: number;
  page: number;
  hasMore: boolean;
  nextCursor: string | null;
  loading: boolean;
  sseStatus: "connected" | "reconnecting" | "disconnected";
}

export function useRetriesViewModel() {
  const [state, setState] = useState<RetriesState>({
    retries: [],
    statusFilter: "failed",
    sourceFilter: null,
    failedCount: 0,
    page: 1,
    hasMore: false,
    nextCursor: null,
    loading: true,
    sseStatus: "disconnected",
  });

  const cursorStack = useRef<(string | null)[]>([null]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchPage = useCallback(async (
    cursor: string | null,
    status: RetryStatus | null,
    source: RetrySource | null,
  ) => {
    setState((s) => ({ ...s, loading: true }));
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (cursor) params.set("before", cursor);
    if (status) params.set("status", status);
    if (source) params.set("source", source);

    const res = await fetch(`/api/retries?${params}`);
    const data = await res.json();

    setState((s) => ({
      ...s,
      retries: data.retries ?? [],
      failedCount: data.failed_count ?? 0,
      hasMore: data.has_more ?? false,
      nextCursor: data.next_cursor ?? null,
      loading: false,
    }));
  }, []);

  // Initial load
  useEffect(() => {
    cursorStack.current = [null];
    fetchPage(null, state.statusFilter, state.sourceFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/api/retries/stream");
    eventSourceRef.current = es;

    es.addEventListener("open", () => {
      setState((s) => ({ ...s, sseStatus: "connected" }));
    });

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setState((s) => ({ ...s, failedCount: data.failedCount ?? 0 }));
    });

    es.addEventListener("retry", (e) => {
      const event: RetryEvent = JSON.parse(e.data);
      const retry = event.retry;

      setState((s) => {
        let updatedRetries = s.retries;
        let failedCount = s.failedCount;

        if (event.type === "retry.created") {
          failedCount += 1;
          // If viewing failed and on page 1, prepend
          if ((s.statusFilter === "failed" || s.statusFilter === null) && s.page === 1) {
            if (!s.retries.some((r) => r.id === retry.id)) {
              updatedRetries = [retry, ...s.retries];
            }
          }
        } else if (event.type === "retry.resolved" || event.type === "retry.dismissed") {
          failedCount = Math.max(0, failedCount - 1);
          // Update in-place
          updatedRetries = s.retries.map((r) =>
            r.id === retry.id ? retry : r
          );
          // If filtering by failed, remove resolved/dismissed
          if (s.statusFilter === "failed") {
            updatedRetries = updatedRetries.filter((r) => r.status === "failed");
          }
        } else if (event.type === "retry.failed") {
          // Update in-place (attempt count changed)
          updatedRetries = s.retries.map((r) =>
            r.id === retry.id ? retry : r
          );
        }

        return { ...s, retries: updatedRetries, failedCount };
      });
    });

    es.addEventListener("error", () => {
      setState((s) => ({ ...s, sseStatus: "reconnecting" }));
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, []);

  const setStatusFilter = useCallback((status: RetryStatus | null) => {
    setState((s) => ({ ...s, statusFilter: status, page: 1 }));
    cursorStack.current = [null];
    fetchPage(null, status, state.sourceFilter);
  }, [fetchPage, state.sourceFilter]);

  const setSourceFilter = useCallback((source: RetrySource | null) => {
    setState((s) => ({ ...s, sourceFilter: source, page: 1 }));
    cursorStack.current = [null];
    fetchPage(null, state.statusFilter, source);
  }, [fetchPage, state.statusFilter]);

  const retry = useCallback(async (id: string) => {
    // Optimistic update
    setState((s) => ({
      ...s,
      retries: s.retries.map((r) =>
        r.id === id ? { ...r, status: "retrying" as const } : r
      ),
    }));

    const res = await fetch("/api/retries/retry", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });

    if (!res.ok) {
      // Rollback on failure — refetch
      fetchPage(
        cursorStack.current[cursorStack.current.length - 1] ?? null,
        state.statusFilter,
        state.sourceFilter,
      );
    }
  }, [fetchPage, state.statusFilter, state.sourceFilter]);

  const dismiss = useCallback(async (id: string) => {
    // Optimistic update
    setState((s) => ({
      ...s,
      retries: s.retries.map((r) =>
        r.id === id ? { ...r, status: "dismissed" as const } : r
      ),
    }));

    const res = await fetch("/api/retries", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "dismiss" }),
    });

    if (!res.ok) {
      fetchPage(
        cursorStack.current[cursorStack.current.length - 1] ?? null,
        state.statusFilter,
        state.sourceFilter,
      );
    }
  }, [fetchPage, state.statusFilter, state.sourceFilter]);

  const nextPage = useCallback(() => {
    setState((s) => {
      if (!s.hasMore || !s.nextCursor) return s;
      const newPage = s.page + 1;
      cursorStack.current.push(s.nextCursor);
      fetchPage(s.nextCursor, s.statusFilter, s.sourceFilter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  const prevPage = useCallback(() => {
    setState((s) => {
      if (s.page <= 1) return s;
      const newPage = s.page - 1;
      cursorStack.current.pop();
      const cursor = cursorStack.current[cursorStack.current.length - 1] ?? null;
      fetchPage(cursor, s.statusFilter, s.sourceFilter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  return {
    retries: state.retries,
    statusFilter: state.statusFilter,
    sourceFilter: state.sourceFilter,
    failedCount: state.failedCount,
    page: state.page,
    hasMore: state.hasMore,
    loading: state.loading,
    sseStatus: state.sseStatus,
    setStatusFilter,
    setSourceFilter,
    retry,
    dismiss,
    nextPage,
    prevPage,
  };
}

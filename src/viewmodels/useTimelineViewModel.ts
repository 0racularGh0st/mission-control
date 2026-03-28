"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { TimelineEvent, TimelineSource } from "@/src/types/timeline";

const PAGE_SIZE = 50;

interface TimelineState {
  events: TimelineEvent[];
  filter: TimelineSource[];
  page: number;
  hasMore: boolean;
  nextCursor: string | null;
  loading: boolean;
  sseStatus: "connected" | "reconnecting" | "disconnected";
}

export function useTimelineViewModel() {
  const [state, setState] = useState<TimelineState>({
    events: [],
    filter: [],
    page: 1,
    hasMore: false,
    nextCursor: null,
    loading: true,
    sseStatus: "disconnected",
  });

  const cursorStack = useRef<(string | null)[]>([null]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchPage = useCallback(async (cursor: string | null, sources: TimelineSource[]) => {
    setState((s) => ({ ...s, loading: true }));
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (cursor) params.set("before", cursor);
    if (sources.length > 0) params.set("source", sources.join(","));

    const res = await fetch(`/api/timeline?${params}`);
    const data = await res.json();

    setState((s) => ({
      ...s,
      events: data.events ?? [],
      hasMore: data.has_more ?? false,
      nextCursor: data.next_cursor ?? null,
      loading: false,
    }));
  }, []);

  // Initial load
  useEffect(() => {
    cursorStack.current = [null];
    fetchPage(null, state.filter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/api/timeline/stream");
    eventSourceRef.current = es;

    es.addEventListener("open", () => {
      setState((s) => ({ ...s, sseStatus: "connected" }));
    });

    es.addEventListener("timeline", (e) => {
      const event: TimelineEvent = JSON.parse(e.data);

      setState((s) => {
        // Only prepend if on page 1 and matches filter
        if (s.page !== 1) return s;
        if (s.filter.length > 0 && !s.filter.includes(event.source)) return s;

        // Deduplicate
        if (s.events.some((ev) => ev.id === event.id)) return s;

        return { ...s, events: [event, ...s.events] };
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

  const setFilter = useCallback((sources: TimelineSource[]) => {
    setState((s) => ({ ...s, filter: sources, page: 1 }));
    cursorStack.current = [null];
    fetchPage(null, sources);
  }, [fetchPage]);

  const nextPage = useCallback(() => {
    setState((s) => {
      if (!s.hasMore || !s.nextCursor) return s;
      const newPage = s.page + 1;
      cursorStack.current.push(s.nextCursor);
      fetchPage(s.nextCursor, s.filter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  const prevPage = useCallback(() => {
    setState((s) => {
      if (s.page <= 1) return s;
      const newPage = s.page - 1;
      cursorStack.current.pop();
      const cursor = cursorStack.current[cursorStack.current.length - 1] ?? null;
      fetchPage(cursor, s.filter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  return {
    events: state.events,
    filter: state.filter,
    page: state.page,
    hasMore: state.hasMore,
    loading: state.loading,
    sseStatus: state.sseStatus,
    setFilter,
    nextPage,
    prevPage,
  };
}

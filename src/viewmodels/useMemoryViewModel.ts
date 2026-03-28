"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import type { MemoryEntry, MemoryEdge, MemoryType, MemoryScanResult } from "@/src/types/memory";

export type MemoryView = "graph" | "list";

interface MemoryState {
  entries: MemoryEntry[];
  edges: MemoryEdge[];
  total: number;
  selectedEntry: MemoryEntry | null;
  view: MemoryView;
  agentFilter: string | null;
  typeFilter: MemoryType | null;
  search: string;
  loading: boolean;
  scanning: boolean;
  scanResult: MemoryScanResult | null;
  sseStatus: "connected" | "reconnecting" | "disconnected";
}

export function useMemoryViewModel() {
  const [state, setState] = useState<MemoryState>({
    entries: [],
    edges: [],
    total: 0,
    selectedEntry: null,
    view: "list",
    agentFilter: null,
    typeFilter: null,
    search: "",
    loading: true,
    scanning: false,
    scanResult: null,
    sseStatus: "disconnected",
  });

  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchData = useCallback(async (view: MemoryView, agent?: string | null, memType?: MemoryType | null, search?: string) => {
    setState((s) => ({ ...s, loading: true }));
    try {
      const params = new URLSearchParams();
      params.set("format", view === "graph" ? "graph" : "list");
      if (agent) params.set("agent", agent);
      if (memType) params.set("type", memType);
      if (search) params.set("search", search);

      const res = await fetch(`/api/memory?${params}`);
      const data = await res.json();

      if (view === "graph") {
        setState((s) => ({
          ...s,
          entries: data.nodes ?? [],
          edges: data.edges ?? [],
          total: (data.nodes ?? []).length,
          loading: false,
        }));
      } else {
        setState((s) => ({
          ...s,
          entries: data.entries ?? [],
          edges: [],
          total: data.total ?? 0,
          loading: false,
        }));
      }
    } catch {
      setState((s) => ({ ...s, loading: false }));
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchData(state.view, state.agentFilter, state.typeFilter, state.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/api/memory/stream");
    eventSourceRef.current = es;

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setState((s) => ({
        ...s,
        entries: data.entries ?? s.entries,
        total: data.total ?? s.total,
        sseStatus: "connected",
      }));
    });

    es.addEventListener("memory", (e) => {
      const event = JSON.parse(e.data);
      if (event.type === "memory.scanned") {
        // Refetch after scan
        fetchData(state.view, state.agentFilter, state.typeFilter, state.search);
      } else if (event.type === "memory.deleted") {
        setState((s) => ({
          ...s,
          entries: s.entries.filter((entry) => entry.id !== event.entryId),
          total: Math.max(0, s.total - 1),
          selectedEntry: s.selectedEntry?.id === event.entryId ? null : s.selectedEntry,
        }));
      }
    });

    es.addEventListener("open", () => {
      setState((s) => ({ ...s, sseStatus: "connected" }));
    });

    es.addEventListener("error", () => {
      setState((s) => ({ ...s, sseStatus: "reconnecting" }));
    });

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setView = useCallback((view: MemoryView) => {
    setState((s) => ({ ...s, view }));
    fetchData(view, state.agentFilter, state.typeFilter, state.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, state.agentFilter, state.typeFilter, state.search]);

  const setAgentFilter = useCallback((agent: string | null) => {
    setState((s) => ({ ...s, agentFilter: agent }));
    fetchData(state.view, agent, state.typeFilter, state.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, state.view, state.typeFilter, state.search]);

  const setTypeFilter = useCallback((memType: MemoryType | null) => {
    setState((s) => ({ ...s, typeFilter: memType }));
    fetchData(state.view, state.agentFilter, memType, state.search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, state.view, state.agentFilter, state.search]);

  const setSearch = useCallback((search: string) => {
    setState((s) => ({ ...s, search }));
    fetchData(state.view, state.agentFilter, state.typeFilter, search);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchData, state.view, state.agentFilter, state.typeFilter]);

  const selectEntry = useCallback((entry: MemoryEntry | null) => {
    setState((s) => ({ ...s, selectedEntry: entry }));
  }, []);

  const triggerScan = useCallback(async () => {
    setState((s) => ({ ...s, scanning: true, scanResult: null }));
    try {
      const res = await fetch("/api/memory/scan", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setState((s) => ({ ...s, scanning: false, scanResult: data.result }));
        // SSE will trigger refetch
      } else {
        setState((s) => ({ ...s, scanning: false }));
      }
    } catch {
      setState((s) => ({ ...s, scanning: false }));
    }
  }, []);

  const deleteEntry = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/memory/${id}`, { method: "DELETE" });
      if (res.ok) {
        // Optimistic removal
        setState((s) => ({
          ...s,
          entries: s.entries.filter((e) => e.id !== id),
          total: Math.max(0, s.total - 1),
          selectedEntry: s.selectedEntry?.id === id ? null : s.selectedEntry,
        }));
      }
    } catch {
      // silent fail
    }
  }, []);

  return {
    entries: state.entries,
    edges: state.edges,
    total: state.total,
    selectedEntry: state.selectedEntry,
    view: state.view,
    agentFilter: state.agentFilter,
    typeFilter: state.typeFilter,
    search: state.search,
    loading: state.loading,
    scanning: state.scanning,
    scanResult: state.scanResult,
    sseStatus: state.sseStatus,
    setView,
    setAgentFilter,
    setTypeFilter,
    setSearch,
    selectEntry,
    triggerScan,
    deleteEntry,
  };
}

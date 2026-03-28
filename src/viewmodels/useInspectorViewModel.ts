"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { InspectorData, InspectorSource } from "@/src/types/inspector";

interface InspectorState {
  source: InspectorSource | null;
  id: string | null;
  data: InspectorData | null;
  selectedMessageIndex: number | null;
  loading: boolean;
  error: string | null;
  isOpen: boolean;
}

export function useInspectorViewModel() {
  const [state, setState] = useState<InspectorState>({
    source: null,
    id: null,
    data: null,
    selectedMessageIndex: null,
    loading: false,
    error: null,
    isOpen: false,
  });

  const abortRef = useRef<AbortController | null>(null);

  const fetchInspectorData = useCallback(async (source: InspectorSource, id: string) => {
    // Abort any in-flight request
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setState((s) => ({
      ...s,
      source,
      id,
      loading: true,
      error: null,
      selectedMessageIndex: null,
      isOpen: true,
    }));

    try {
      const res = await fetch(`/api/inspect/${source}/${id}`, {
        signal: controller.signal,
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Failed to load" }));
        setState((s) => ({
          ...s,
          data: null,
          loading: false,
          error: body.error ?? "Failed to load inspector data",
        }));
        return;
      }

      const data: InspectorData = await res.json();
      setState((s) => ({
        ...s,
        data,
        loading: false,
        error: null,
      }));
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setState((s) => ({
        ...s,
        data: null,
        loading: false,
        error: "Failed to load inspector data",
      }));
    }
  }, []);

  const inspect = useCallback((source: InspectorSource, id: string) => {
    fetchInspectorData(source, id);
  }, [fetchInspectorData]);

  const close = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setState((s) => ({
      ...s,
      isOpen: false,
      data: null,
      source: null,
      id: null,
      selectedMessageIndex: null,
      error: null,
    }));
  }, []);

  const togglePanel = useCallback(() => {
    setState((s) => {
      if (s.isOpen) {
        return { ...s, isOpen: false };
      }
      return { ...s, isOpen: true };
    });
  }, []);

  const selectMessage = useCallback((index: number | null) => {
    setState((s) => ({ ...s, selectedMessageIndex: index }));
  }, []);

  const selectNextMessage = useCallback(() => {
    setState((s) => {
      if (!s.data || s.data.messages.length === 0) return s;
      const maxIndex = s.data.messages.length - 1;
      const next = s.selectedMessageIndex === null ? 0 : Math.min(s.selectedMessageIndex + 1, maxIndex);
      return { ...s, selectedMessageIndex: next };
    });
  }, []);

  const selectPrevMessage = useCallback(() => {
    setState((s) => {
      if (!s.data || s.data.messages.length === 0) return s;
      const prev = s.selectedMessageIndex === null ? 0 : Math.max(s.selectedMessageIndex - 1, 0);
      return { ...s, selectedMessageIndex: prev };
    });
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return {
    source: state.source,
    id: state.id,
    data: state.data,
    selectedMessageIndex: state.selectedMessageIndex,
    loading: state.loading,
    error: state.error,
    isOpen: state.isOpen,
    inspect,
    close,
    togglePanel,
    selectMessage,
    selectNextMessage,
    selectPrevMessage,
  };
}

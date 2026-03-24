"use client";

import { useEffect, useRef, useState } from "react";

import type { DashboardIncrementalPatchDto, DashboardRuntimeStateDto, DashboardSnapshotDto } from "@/src/runtime/dashboard/types";

const MAX_LOGS = 40;

export interface DashboardRuntimeMeta {
  source: DashboardRuntimeStateDto["source"];
  transport: DashboardRuntimeStateDto["transport"];
  recommendedPollMs: number;
  incrementalSupported: boolean;
  ssePath?: string;
}

export function applyDashboardPatch(snapshot: DashboardSnapshotDto, patch: DashboardIncrementalPatchDto): DashboardSnapshotDto {
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

export function useDashboardRuntime({ initialRuntime, cursorStorageKey }: { initialRuntime: DashboardRuntimeStateDto; cursorStorageKey: string }) {
  const [snapshot, setSnapshot] = useState(initialRuntime.snapshot);
  const [runtimeMeta, setRuntimeMeta] = useState<DashboardRuntimeMeta>({
    source: initialRuntime.source,
    transport: initialRuntime.transport,
    recommendedPollMs: initialRuntime.recommendedPollMs,
    incrementalSupported: initialRuntime.incrementalSupported,
    ssePath: initialRuntime.ssePath,
  });

  const cursorRef = useRef(initialRuntime.cursor);

  useEffect(() => {
    try {
      const persisted = window.localStorage.getItem(cursorStorageKey);
      if (persisted) {
        cursorRef.current = persisted;
      }
    } catch {
      // ignore storage failures
    }
  }, [cursorStorageKey]);

  useEffect(() => {
    const persistCursor = (cursor: string) => {
      cursorRef.current = cursor;
      try {
        window.localStorage.setItem(cursorStorageKey, cursor);
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
        setSnapshot((prev) => runtime.updates.reduce((acc, patch) => applyDashboardPatch(acc, patch), prev));
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
        setSnapshot((prev) => applyDashboardPatch(prev, patch));
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
  }, [cursorStorageKey, runtimeMeta.incrementalSupported, runtimeMeta.recommendedPollMs, runtimeMeta.ssePath]);

  return {
    snapshot,
    runtimeMeta,
  };
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Approval, ApprovalStatus } from "@/src/types/approvals";
import type { ApprovalEvent } from "@/src/runtime/approvals/eventsBus";

const PAGE_SIZE = 50;

interface ApprovalsState {
  approvals: Approval[];
  statusFilter: ApprovalStatus | null; // null = all
  pendingCount: number;
  page: number;
  hasMore: boolean;
  nextCursor: string | null;
  loading: boolean;
  sseStatus: "connected" | "reconnecting" | "disconnected";
}

export function useApprovalsViewModel() {
  const [state, setState] = useState<ApprovalsState>({
    approvals: [],
    statusFilter: "pending",
    pendingCount: 0,
    page: 1,
    hasMore: false,
    nextCursor: null,
    loading: true,
    sseStatus: "disconnected",
  });

  const cursorStack = useRef<(string | null)[]>([null]);
  const eventSourceRef = useRef<EventSource | null>(null);

  const fetchPage = useCallback(async (cursor: string | null, status: ApprovalStatus | null) => {
    setState((s) => ({ ...s, loading: true }));
    const params = new URLSearchParams();
    params.set("limit", String(PAGE_SIZE));
    if (cursor) params.set("before", cursor);
    if (status) params.set("status", status);

    const res = await fetch(`/api/approvals?${params}`);
    const data = await res.json();

    setState((s) => ({
      ...s,
      approvals: data.approvals ?? [],
      pendingCount: data.pending_count ?? 0,
      hasMore: data.has_more ?? false,
      nextCursor: data.next_cursor ?? null,
      loading: false,
    }));
  }, []);

  // Initial load
  useEffect(() => {
    cursorStack.current = [null];
    fetchPage(null, state.statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SSE subscription
  useEffect(() => {
    const es = new EventSource("/api/approvals/stream");
    eventSourceRef.current = es;

    es.addEventListener("open", () => {
      setState((s) => ({ ...s, sseStatus: "connected" }));
    });

    es.addEventListener("snapshot", (e) => {
      const data = JSON.parse(e.data);
      setState((s) => ({ ...s, pendingCount: data.pendingCount ?? 0 }));
    });

    es.addEventListener("approval", (e) => {
      const event: ApprovalEvent = JSON.parse(e.data);
      const approval = event.approval;

      setState((s) => {
        let updatedApprovals = s.approvals;
        let pendingCount = s.pendingCount;

        if (event.type === "approval.requested") {
          pendingCount += 1;
          // If viewing pending and on page 1, prepend
          if ((s.statusFilter === "pending" || s.statusFilter === null) && s.page === 1) {
            if (!s.approvals.some((a) => a.id === approval.id)) {
              updatedApprovals = [approval, ...s.approvals];
            }
          }
        } else {
          // Resolved or expired — decrement pending if it was pending
          if (event.type === "approval.approved" || event.type === "approval.rejected" || event.type === "approval.expired") {
            pendingCount = Math.max(0, pendingCount - 1);
          }

          // Update in-place if the approval is visible
          updatedApprovals = s.approvals.map((a) =>
            a.id === approval.id ? approval : a
          );

          // If filtering by pending, remove resolved items
          if (s.statusFilter === "pending") {
            updatedApprovals = updatedApprovals.filter((a) => a.status === "pending");
          }
        }

        return { ...s, approvals: updatedApprovals, pendingCount };
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

  const setFilter = useCallback((status: ApprovalStatus | null) => {
    setState((s) => ({ ...s, statusFilter: status, page: 1 }));
    cursorStack.current = [null];
    fetchPage(null, status);
  }, [fetchPage]);

  const approve = useCallback(async (id: string, comment?: string) => {
    // Optimistic update
    setState((s) => ({
      ...s,
      approvals: s.approvals.map((a) =>
        a.id === id ? { ...a, status: "approved" as const, comment: comment ?? "" } : a
      ),
    }));

    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "approve", comment }),
    });

    if (!res.ok) {
      // Rollback on failure — refetch
      fetchPage(cursorStack.current[cursorStack.current.length - 1] ?? null, state.statusFilter);
    }
  }, [fetchPage, state.statusFilter]);

  const reject = useCallback(async (id: string, comment?: string) => {
    setState((s) => ({
      ...s,
      approvals: s.approvals.map((a) =>
        a.id === id ? { ...a, status: "rejected" as const, comment: comment ?? "" } : a
      ),
    }));

    const res = await fetch("/api/approvals", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action: "reject", comment }),
    });

    if (!res.ok) {
      fetchPage(cursorStack.current[cursorStack.current.length - 1] ?? null, state.statusFilter);
    }
  }, [fetchPage, state.statusFilter]);

  const nextPage = useCallback(() => {
    setState((s) => {
      if (!s.hasMore || !s.nextCursor) return s;
      const newPage = s.page + 1;
      cursorStack.current.push(s.nextCursor);
      fetchPage(s.nextCursor, s.statusFilter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  const prevPage = useCallback(() => {
    setState((s) => {
      if (s.page <= 1) return s;
      const newPage = s.page - 1;
      cursorStack.current.pop();
      const cursor = cursorStack.current[cursorStack.current.length - 1] ?? null;
      fetchPage(cursor, s.statusFilter);
      return { ...s, page: newPage };
    });
  }, [fetchPage]);

  return {
    approvals: state.approvals,
    statusFilter: state.statusFilter,
    pendingCount: state.pendingCount,
    page: state.page,
    hasMore: state.hasMore,
    loading: state.loading,
    sseStatus: state.sseStatus,
    setFilter,
    approve,
    reject,
    nextPage,
    prevPage,
  };
}

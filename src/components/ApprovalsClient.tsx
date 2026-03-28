"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { SectionHeader } from "@/src/components/primitives";
import { ApprovalCard } from "@/src/components/ApprovalCard";
import { ApprovalFilterBar } from "@/src/components/ApprovalFilterBar";
import { ApprovalDetailPanel } from "@/src/components/ApprovalDetailPanel";
import { useApprovalsViewModel } from "@/src/viewmodels/useApprovalsViewModel";

export function ApprovalsClient() {
  const vm = useApprovalsViewModel();
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useRef(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSelectedApprovalId = useCallback((): string | null => {
    if (!listRef.current || selectedIndex.current < 0) return null;
    const items = listRef.current.querySelectorAll("[data-approval-id]");
    const el = items[selectedIndex.current];
    return el?.getAttribute("data-approval-id") ?? null;
  }, []);

  const updateSelection = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-approval-id]");
    items.forEach((el, i) => {
      if (i === index) {
        el.classList.add("border-accent/50", "bg-accent/10");
        el.scrollIntoView({ block: "nearest" });
      } else {
        el.classList.remove("border-accent/50", "bg-accent/10");
      }
    });
    selectedIndex.current = index;
  }, []);

  // Keyboard navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;

      if (e.key === "f") {
        e.preventDefault();
        const filterBtn = document.querySelector("[data-filter-bar] button");
        if (filterBtn instanceof HTMLElement) filterBtn.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const maxIndex = vm.approvals.length - 1;
        const next = Math.min(selectedIndex.current + 1, maxIndex);
        updateSelection(next);
        return;
      }

      if (e.key === "ArrowUp" || e.key === "k") {
        e.preventDefault();
        const prev = Math.max(selectedIndex.current - 1, 0);
        updateSelection(prev);
        return;
      }

      if (e.key === "a") {
        e.preventDefault();
        const id = getSelectedApprovalId();
        if (id) vm.approve(id);
        return;
      }

      if (e.key === "r") {
        e.preventDefault();
        const id = getSelectedApprovalId();
        if (id) vm.reject(id);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const id = getSelectedApprovalId();
        if (id) setExpandedId((prev) => (prev === id ? null : id));
        return;
      }

      if (e.key === "Escape") {
        setExpandedId(null);
        return;
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [vm.approvals.length, updateSelection, getSelectedApprovalId, vm.approve, vm.reject]);

  const expandedApproval = expandedId
    ? vm.approvals.find((a) => a.id === expandedId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          title="Approvals Inbox"
          description="Review, approve, or reject pending actions from agents before they execute."
        />
        <div className="flex items-center gap-2">
          {vm.pendingCount > 0 && (
            <span className="shrink-0 rounded-full bg-amber-400/15 px-2.5 py-0.5 text-[11px] font-medium text-amber-200">
              {vm.pendingCount} pending
            </span>
          )}
          {vm.sseStatus === "reconnecting" && (
            <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      <ApprovalFilterBar active={vm.statusFilter} onChange={vm.setFilter} />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Approval list */}
        <div ref={listRef} className="space-y-1.5">
          {vm.loading && vm.approvals.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-center text-xs text-muted-foreground">
              Loading approvals...
            </div>
          ) : vm.approvals.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-12 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400/50" />
              <p className="text-xs text-muted-foreground">
                All clear. No approvals waiting.
              </p>
            </div>
          ) : (
            vm.approvals.map((approval) => (
              <ApprovalCard
                key={approval.id}
                approval={approval}
                onApprove={(id) => vm.approve(id)}
                onReject={(id) => vm.reject(id)}
                onExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        {expandedApproval && (
          <div className="hidden xl:block">
            <ApprovalDetailPanel
              approval={expandedApproval}
              onClose={() => setExpandedId(null)}
              onApprove={(id, comment) => {
                vm.approve(id, comment);
                setExpandedId(null);
              }}
              onReject={(id, comment) => {
                vm.reject(id, comment);
                setExpandedId(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {vm.approvals.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <button
            onClick={vm.prevPage}
            disabled={vm.page <= 1}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            &larr; Prev
          </button>
          <span className="text-xs text-muted-foreground">Page {vm.page}</span>
          <button
            onClick={vm.nextPage}
            disabled={!vm.hasMore}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Next &rarr;
          </button>
        </div>
      )}
    </div>
  );
}

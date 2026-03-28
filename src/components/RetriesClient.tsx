"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { SectionHeader } from "@/src/components/primitives";
import { RetryCard } from "@/src/components/RetryCard";
import { RetryFilterBar } from "@/src/components/RetryFilterBar";
import { RetryDetailPanel } from "@/src/components/RetryDetailPanel";
import { useRetriesViewModel } from "@/src/viewmodels/useRetriesViewModel";

export function RetriesClient() {
  const vm = useRetriesViewModel();
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useRef(-1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getSelectedRetryId = useCallback((): string | null => {
    if (!listRef.current || selectedIndex.current < 0) return null;
    const items = listRef.current.querySelectorAll("[data-retry-id]");
    const el = items[selectedIndex.current];
    return el?.getAttribute("data-retry-id") ?? null;
  }, []);

  const updateSelection = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-retry-id]");
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
        const maxIndex = vm.retries.length - 1;
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

      if (e.key === "R" || (e.key === "r" && !e.metaKey && !e.ctrlKey)) {
        // Use uppercase R to avoid conflict; also handle lowercase r
        e.preventDefault();
        const id = getSelectedRetryId();
        if (id) vm.retry(id);
        return;
      }

      if (e.key === "d") {
        e.preventDefault();
        const id = getSelectedRetryId();
        if (id) vm.dismiss(id);
        return;
      }

      if (e.key === "Enter") {
        e.preventDefault();
        const id = getSelectedRetryId();
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
  }, [vm.retries.length, updateSelection, getSelectedRetryId, vm.retry, vm.dismiss]);

  const expandedRetry = expandedId
    ? vm.retries.find((r) => r.id === expandedId) ?? null
    : null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          title="Retry Center"
          description="Surface failures, inspect errors, and retry operations with one click."
        />
        <div className="flex items-center gap-2">
          {vm.failedCount > 0 && (
            <span className="shrink-0 rounded-full bg-red-500/15 px-2.5 py-0.5 text-[11px] font-medium text-red-300">
              {vm.failedCount} failed
            </span>
          )}
          {vm.sseStatus === "reconnecting" && (
            <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
              Reconnecting...
            </span>
          )}
        </div>
      </div>

      <RetryFilterBar
        activeStatus={vm.statusFilter}
        activeSource={vm.sourceFilter}
        onStatusChange={vm.setStatusFilter}
        onSourceChange={vm.setSourceFilter}
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_340px]">
        {/* Retry list */}
        <div ref={listRef} className="space-y-1.5">
          {vm.loading && vm.retries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-center text-xs text-muted-foreground">
              Loading retries...
            </div>
          ) : vm.retries.length === 0 ? (
            <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-12 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400/50" />
              <p className="text-xs text-muted-foreground">
                All systems nominal. No failures to retry.
              </p>
            </div>
          ) : (
            vm.retries.map((entry) => (
              <RetryCard
                key={entry.id}
                retry={entry}
                onRetry={(id) => vm.retry(id)}
                onDismiss={(id) => vm.dismiss(id)}
                onExpand={(id) => setExpandedId((prev) => (prev === id ? null : id))}
              />
            ))
          )}
        </div>

        {/* Detail panel */}
        {expandedRetry && (
          <div className="hidden xl:block">
            <RetryDetailPanel
              retry={expandedRetry}
              onClose={() => setExpandedId(null)}
              onRetry={(id) => {
                vm.retry(id);
                setExpandedId(null);
              }}
              onDismiss={(id) => {
                vm.dismiss(id);
                setExpandedId(null);
              }}
            />
          </div>
        )}
      </div>

      {/* Pagination */}
      {vm.retries.length > 0 && (
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

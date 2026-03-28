"use client";

import { useCallback, useEffect, useRef } from "react";

import { SectionHeader } from "@/src/components/primitives";
import { TimelineEventRow } from "@/src/components/TimelineEvent";
import { TimelineFilterBar } from "@/src/components/TimelineFilterBar";
import { useTimelineViewModel } from "@/src/viewmodels/useTimelineViewModel";

export function TimelineClient() {
  const vm = useTimelineViewModel();
  const listRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useRef(-1);

  const updateSelection = useCallback((index: number) => {
    if (!listRef.current) return;
    const items = listRef.current.querySelectorAll("[data-event-id]");
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
        // Focus filter bar — first button
        const filterBtn = document.querySelector("[data-filter-bar] button");
        if (filterBtn instanceof HTMLElement) filterBtn.focus();
        return;
      }

      if (e.key === "ArrowDown" || e.key === "j") {
        e.preventDefault();
        const maxIndex = vm.events.length - 1;
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
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [vm.events.length, updateSelection]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionHeader
          title="Timeline"
          description="Unified chronological feed of all activity across Mission Control."
        />
        {vm.sseStatus === "reconnecting" && (
          <span className="shrink-0 rounded-md border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[11px] text-amber-200">
            Reconnecting…
          </span>
        )}
      </div>

      <div data-filter-bar>
        <TimelineFilterBar active={vm.filter} onChange={vm.setFilter} />
      </div>

      <div ref={listRef} className="space-y-1.5">
        {vm.loading && vm.events.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-center text-xs text-muted-foreground">
            Loading events…
          </div>
        ) : vm.events.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-8 text-center text-xs text-muted-foreground">
            {vm.filter.length > 0
              ? "No events for the selected filter. Try selecting a different source."
              : "No activity yet. Events will appear as tasks and agents run."}
          </div>
        ) : (
          vm.events.map((event) => (
            <TimelineEventRow key={event.id} event={event} />
          ))
        )}
      </div>

      {/* Pagination */}
      {vm.events.length > 0 && (
        <div className="flex items-center justify-between border-t border-border/40 pt-3">
          <button
            onClick={vm.prevPage}
            disabled={vm.page <= 1}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            ← Prev
          </button>
          <span className="text-xs text-muted-foreground">Page {vm.page}</span>
          <button
            onClick={vm.nextPage}
            disabled={!vm.hasMore}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

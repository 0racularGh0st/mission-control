"use client";

import { useEffect, useCallback, useRef, useMemo } from "react";
import { SectionHeader } from "@/src/components/primitives";
import { MemoryList } from "@/src/components/memory/MemoryList";
import { MemoryDetail } from "@/src/components/memory/MemoryDetail";
import { MemoryGraph } from "@/src/components/memory/MemoryGraph";
import { MemoryFilterBar } from "@/src/components/memory/MemoryFilterBar";
import { MemoryScanButton } from "@/src/components/memory/MemoryScanButton";
import { useMemoryViewModel } from "@/src/viewmodels/useMemoryViewModel";
import type { MemoryView } from "@/src/viewmodels/useMemoryViewModel";

function ViewToggle({ view, onChange }: { view: MemoryView; onChange: (v: MemoryView) => void }) {
  return (
    <div className="inline-flex rounded-md border border-border/60 text-xs">
      <button
        type="button"
        onClick={() => onChange("graph")}
        className={`px-2.5 py-1 rounded-l-md transition-colors ${
          view === "graph" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Graph
      </button>
      <button
        type="button"
        onClick={() => onChange("list")}
        className={`px-2.5 py-1 rounded-r-md border-l border-border/60 transition-colors ${
          view === "list" ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:text-foreground"
        }`}
      >
        List
      </button>
    </div>
  );
}

export function MemoryClient() {
  const vm = useMemoryViewModel();
  const listRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  // Derive unique agent list for filter bar
  const agents = useMemo(() => {
    const set = new Set<string>();
    for (const entry of vm.entries) set.add(entry.agent);
    return Array.from(set).sort();
  }, [vm.entries]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;

      // "/" focuses search (when not in input)
      if (e.key === "/" && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      // Tab switches views (when not in input)
      if (e.key === "Tab" && !isInput && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        vm.setView(vm.view === "graph" ? "list" : "graph");
        return;
      }

      // Escape closes detail
      if (e.key === "Escape" && vm.selectedEntry) {
        vm.selectEntry(null);
        return;
      }

      // Arrow keys / j/k in list view
      if (vm.view === "list" && !isInput && vm.entries.length > 0) {
        let direction = 0;
        if (e.key === "ArrowDown" || e.key === "j") direction = 1;
        if (e.key === "ArrowUp" || e.key === "k") direction = -1;

        if (direction !== 0) {
          e.preventDefault();
          const currentIdx = vm.selectedEntry
            ? vm.entries.findIndex((en) => en.id === vm.selectedEntry!.id)
            : -1;
          const nextIdx = Math.max(0, Math.min(vm.entries.length - 1, currentIdx + direction));
          vm.selectEntry(vm.entries[nextIdx]);

          // Scroll into view
          const el = listRef.current?.querySelector(`[data-entry-id="${vm.entries[nextIdx].id}"]`);
          el?.scrollIntoView({ block: "nearest" });
        }
      }
    },
    [vm],
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  // Capture search input ref from filter bar
  useEffect(() => {
    const input = document.querySelector<HTMLInputElement>('[placeholder="Search memories\u2026"]');
    if (input) searchInputRef.current = input;
  });

  return (
    <div className="dashboard-shell space-y-4">
      <div className="flex items-start justify-between gap-4">
        <SectionHeader
          title="Memory Graph"
          description={`${vm.total} memor${vm.total !== 1 ? "ies" : "y"} indexed \u00b7 ${vm.view} view`}
        />
        <div className="flex items-center gap-3 shrink-0">
          <MemoryScanButton
            scanning={vm.scanning}
            scanResult={vm.scanResult}
            onScan={vm.triggerScan}
          />
          <ViewToggle view={vm.view} onChange={vm.setView} />
        </div>
      </div>

      <MemoryFilterBar
        search={vm.search}
        onSearchChange={vm.setSearch}
        typeFilter={vm.typeFilter}
        onTypeChange={vm.setTypeFilter}
        agentFilter={vm.agentFilter}
        onAgentChange={vm.setAgentFilter}
        agents={agents}
      />

      {vm.loading ? (
        <div className="text-sm text-muted-foreground py-8 text-center">Loading memory entries\u2026</div>
      ) : (
        <div className="flex gap-4">
          {/* Main content area */}
          <div className={`flex-1 min-w-0 ${vm.selectedEntry ? "" : "w-full"}`}>
            {vm.view === "graph" ? (
              <MemoryGraph
                entries={vm.entries}
                edges={vm.edges}
                selectedId={vm.selectedEntry?.id ?? null}
                onSelect={vm.selectEntry}
              />
            ) : (
              <MemoryList
                entries={vm.entries}
                selectedId={vm.selectedEntry?.id ?? null}
                onSelect={vm.selectEntry}
                listRef={listRef}
              />
            )}
          </div>

          {/* Detail sidebar */}
          {vm.selectedEntry && (
            <div className="w-80 shrink-0 rounded-lg border border-border/60 bg-background/35 p-4 overflow-y-auto max-h-[600px]">
              <MemoryDetail
                entry={vm.selectedEntry}
                onDelete={vm.deleteEntry}
                onClose={() => vm.selectEntry(null)}
              />
            </div>
          )}
        </div>
      )}

      {/* Keyboard hints */}
      <div className="flex gap-4 text-[10px] text-muted-foreground/50">
        <span><kbd className="px-1 border border-border/40 rounded text-[9px]">/</kbd> search</span>
        <span><kbd className="px-1 border border-border/40 rounded text-[9px]">Tab</kbd> switch view</span>
        <span><kbd className="px-1 border border-border/40 rounded text-[9px]">j/k</kbd> navigate</span>
        <span><kbd className="px-1 border border-border/40 rounded text-[9px]">Esc</kbd> close detail</span>
      </div>
    </div>
  );
}

"use client";

import { Brain, FileText, MessageSquare, Bookmark } from "lucide-react";
import type { MemoryEntry, MemoryType } from "@/src/types/memory";

function typeColor(t: MemoryType): string {
  switch (t) {
    case "user": return "text-sky-400";
    case "feedback": return "text-amber-400";
    case "project": return "text-emerald-400";
    case "reference": return "text-violet-400";
  }
}

function TypeIcon({ type }: { type: MemoryType }) {
  const cls = `size-3.5 ${typeColor(type)}`;
  switch (type) {
    case "user": return <Brain className={cls} />;
    case "feedback": return <MessageSquare className={cls} />;
    case "project": return <FileText className={cls} />;
    case "reference": return <Bookmark className={cls} />;
  }
}

function formatRelativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

interface MemoryListProps {
  entries: MemoryEntry[];
  selectedId: string | null;
  onSelect: (entry: MemoryEntry) => void;
  listRef: React.RefObject<HTMLDivElement | null>;
}

export function MemoryList({ entries, selectedId, onSelect, listRef }: MemoryListProps) {
  if (entries.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-4 py-8 text-center">
        <Brain className="mx-auto mb-2 h-8 w-8 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          No agent memories discovered.
        </p>
        <p className="mt-1 text-xs text-muted-foreground/60">
          Memories appear as agents accumulate context. Try running a scan.
        </p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="space-y-1">
      {entries.map((entry) => (
        <button
          key={entry.id}
          type="button"
          data-entry-id={entry.id}
          onClick={() => onSelect(entry)}
          className={`w-full text-left rounded-lg border px-3 py-2.5 transition-colors ${
            selectedId === entry.id
              ? "border-accent/50 bg-accent/10"
              : "border-border/60 bg-background/35 hover:bg-muted/30"
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <TypeIcon type={entry.memType} />
              <span className="text-sm font-medium truncate">{entry.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className={`text-[10px] rounded-full px-1.5 py-0.5 border ${
                entry.memType === "user" ? "border-sky-500/30 text-sky-400" :
                entry.memType === "feedback" ? "border-amber-500/30 text-amber-400" :
                entry.memType === "project" ? "border-emerald-500/30 text-emerald-400" :
                "border-violet-500/30 text-violet-400"
              }`}>
                {entry.memType}
              </span>
              <span className="text-[10px] text-muted-foreground">{formatRelativeTime(entry.updatedAt)}</span>
            </div>
          </div>
          {entry.description && (
            <p className="mt-1 text-xs text-muted-foreground truncate pl-5.5">{entry.description}</p>
          )}
          {entry.topics.length > 0 && (
            <div className="mt-1.5 flex gap-1 pl-5.5 flex-wrap">
              {entry.topics.slice(0, 4).map((topic) => (
                <span key={topic} className="text-[10px] text-muted-foreground/70 bg-muted/40 rounded px-1 py-0.5">
                  {topic}
                </span>
              ))}
              {entry.topics.length > 4 && (
                <span className="text-[10px] text-muted-foreground/50">+{entry.topics.length - 4}</span>
              )}
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

"use client";

import { Brain, FileText, MessageSquare, Bookmark, Trash2, ExternalLink, Clock3, User, Tag } from "lucide-react";
import type { MemoryEntry, MemoryType } from "@/src/types/memory";

function TypeIcon({ type }: { type: MemoryType }) {
  const cls = "size-4";
  switch (type) {
    case "user": return <Brain className={`${cls} text-sky-400`} />;
    case "feedback": return <MessageSquare className={`${cls} text-amber-400`} />;
    case "project": return <FileText className={`${cls} text-emerald-400`} />;
    case "reference": return <Bookmark className={`${cls} text-violet-400`} />;
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

interface MemoryDetailProps {
  entry: MemoryEntry;
  onDelete: (id: string) => void;
  onClose: () => void;
}

export function MemoryDetail({ entry, onDelete, onClose }: MemoryDetailProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon type={entry.memType} />
          <h3 className="text-sm font-medium truncate">{entry.name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Esc
        </button>
      </div>

      {entry.description && (
        <p className="text-xs text-muted-foreground">{entry.description}</p>
      )}

      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2 text-muted-foreground">
          <User className="size-3" />
          <span>Agent: {entry.agent}</span>
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Clock3 className="size-3" />
          <span>Updated: {formatRelativeTime(entry.updatedAt)}</span>
        </div>
        {entry.topics.length > 0 && (
          <div className="flex items-start gap-2 text-muted-foreground">
            <Tag className="size-3 mt-0.5" />
            <div className="flex flex-wrap gap-1">
              {entry.topics.map((topic) => (
                <span key={topic} className="bg-muted/40 rounded px-1.5 py-0.5 text-[10px]">
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-border/40 pt-3">
        <div className="rounded-md border border-border/40 bg-background/20 p-3 max-h-[400px] overflow-y-auto">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words">
            {entry.content}
          </pre>
        </div>
      </div>

      <div className="flex items-center justify-between text-[10px] text-muted-foreground/60 truncate">
        <span>{entry.sourcePath}</span>
      </div>

      <button
        type="button"
        onClick={() => {
          if (confirm(`Delete memory "${entry.name}"? This will also remove the file from disk.`)) {
            onDelete(entry.id);
          }
        }}
        className="flex items-center gap-1.5 text-xs text-red-400 hover:text-red-300 transition-colors"
      >
        <Trash2 className="size-3" />
        Delete memory
      </button>
    </div>
  );
}

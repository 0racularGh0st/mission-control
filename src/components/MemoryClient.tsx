"use client";

import { useEffect, useState } from "react";
import { Clock3, FileText, HardDrive, ScrollText } from "lucide-react";

import { Panel, SectionHeader } from "@/src/components/primitives";
import { cn } from "@/lib/utils";

type MemoryEntryType = "daily" | "longterm" | "obsidian";

interface MemoryEntry {
  id: string;
  type: MemoryEntryType;
  title: string;
  path: string;
  modifiedAt: string;
  sizeBytes: number;
  preview: string;
}

type GroupedEntries = {
  type: MemoryEntryType;
  label: string;
  icon: React.ReactNode;
  entries: MemoryEntry[];
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
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

function TypeIcon({ type }: { type: MemoryEntryType }) {
  switch (type) {
    case "longterm":
      return <HardDrive className="size-4 text-emerald-400" />;
    case "daily":
      return <ScrollText className="size-4 text-sky-400" />;
    case "obsidian":
      return <FileText className="size-4 text-violet-400" />;
  }
}

function MemoryEntryCard({ entry }: { entry: MemoryEntry }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-lg border border-border/60 bg-background/35 overflow-hidden">
      <button
        type="button"
        className="w-full text-left px-4 py-3 hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <TypeIcon type={entry.type} />
            <span className="font-medium text-sm truncate">{entry.title}</span>
          </div>
          <div className="flex items-center gap-3 shrink-0 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Clock3 className="size-3" />
              {formatRelativeTime(entry.modifiedAt)}
            </span>
            <span>{formatBytes(entry.sizeBytes)}</span>
          </div>
        </div>
        <div className="mt-1.5 text-xs text-muted-foreground truncate pl-6">
          {entry.preview.split("\n").find((l) => l.trim()) ?? ""}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border/40 px-4 py-3 bg-muted/10">
          <pre className="text-xs font-mono text-muted-foreground whitespace-pre-wrap break-words max-h-80 overflow-y-auto">
            {entry.preview}
          </pre>
          <div className="mt-2 text-[10px] text-muted-foreground/60 truncate">{entry.path}</div>
        </div>
      )}
    </div>
  );
}

export function MemoryClient() {
  const [entries, setEntries] = useState<MemoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/memory")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error);
        } else {
          setEntries(data.entries ?? []);
        }
      })
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const grouped: GroupedEntries[] = [
    {
      type: "longterm" as MemoryEntryType,
      label: "Long-term Memory",
      icon: <HardDrive className="size-4 text-emerald-400" />,
      entries: entries.filter((e) => e.type === "longterm"),
    },
    {
      type: "daily" as MemoryEntryType,
      label: "Daily Notes",
      icon: <ScrollText className="size-4 text-sky-400" />,
      entries: entries.filter((e) => e.type === "daily"),
    },
    {
      type: "obsidian" as MemoryEntryType,
      label: "Obsidian Vault (Jarvis)",
      icon: <FileText className="size-4 text-violet-400" />,
      entries: entries.filter((e) => e.type === "obsidian"),
    },
  ].filter((g) => g.entries.length > 0) as GroupedEntries[];

  return (
    <div className="dashboard-shell space-y-6">
      <SectionHeader
        title="Memory"
        description="Workspace memory surface — long-term, daily notes, and Obsidian vault entries."
      />

      {loading && <div className="text-sm text-muted-foreground">Loading memory entries…</div>}

      {error && <div className="text-sm text-red-400">Failed to load memory: {error}</div>}

      {!loading && !error && grouped.length === 0 && (
        <div className="text-sm text-muted-foreground">
          No memory entries found. Memory files should be at{" "}
          <code className="text-xs bg-muted px-1 rounded">~/.openclaw/workspace/memory/</code> or{" "}
          <code className="text-xs bg-muted px-1 rounded">~/.openclaw/workspace/MEMORY.md</code>.
        </div>
      )}

      {grouped.map((group) => (
        <Panel
          key={group.type}
          title={group.label}
          description={`${group.entries.length} entr${group.entries.length !== 1 ? "ies" : "y"}`}
        >
          <div className="space-y-2">
            {group.entries.map((entry) => (
              <MemoryEntryCard key={entry.id} entry={entry} />
            ))}
          </div>
        </Panel>
      ))}
    </div>
  );
}

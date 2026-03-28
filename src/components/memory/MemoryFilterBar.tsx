"use client";

import { Search } from "lucide-react";
import type { MemoryType } from "@/src/types/memory";
import { MEMORY_TYPES } from "@/src/types/memory";

interface MemoryFilterBarProps {
  search: string;
  onSearchChange: (value: string) => void;
  typeFilter: MemoryType | null;
  onTypeChange: (value: MemoryType | null) => void;
  agentFilter: string | null;
  onAgentChange: (value: string | null) => void;
  agents: string[];
}

export function MemoryFilterBar({
  search,
  onSearchChange,
  typeFilter,
  onTypeChange,
  agentFilter,
  onAgentChange,
  agents,
}: MemoryFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-[200px]">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search memories…"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-8 w-full rounded-md border border-border/60 bg-background/35 pl-8 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
        />
      </div>

      <select
        value={typeFilter ?? ""}
        onChange={(e) => onTypeChange(e.target.value ? (e.target.value as MemoryType) : null)}
        className="h-8 rounded-md border border-border/60 bg-background/35 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        <option value="">All types</option>
        {MEMORY_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>

      <select
        value={agentFilter ?? ""}
        onChange={(e) => onAgentChange(e.target.value || null)}
        className="h-8 rounded-md border border-border/60 bg-background/35 px-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-accent/50"
      >
        <option value="">All agents</option>
        {agents.map((a) => (
          <option key={a} value={a}>
            {a}
          </option>
        ))}
      </select>
    </div>
  );
}

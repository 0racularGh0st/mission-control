"use client";

import { SearchIcon } from "lucide-react";

import { Command, CommandInput } from "@/components/ui/command";
import { cn } from "@/lib/utils";

type CommandBarProps = {
  placeholder?: string;
  className?: string;
};

export function CommandBar({
  placeholder = "Search tasks, agents, logs…",
  className,
}: CommandBarProps) {
  return (
    <div className={cn("glass-panel rounded-xl p-1", className)}>
      <Command className="rounded-lg border border-border/80 bg-card/60">
        <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground">
          <SearchIcon className="size-4" />
          <span className="text-xs">⌘K</span>
        </div>
        <CommandInput placeholder={placeholder} />
      </Command>
    </div>
  );
}

"use client";

import { SearchIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type CommandBarProps = {
  placeholder?: string;
  className?: string;
};

export function CommandBar({
  placeholder = "Search tasks, agents, logs…",
  className,
}: CommandBarProps) {
  function handleClick() {
    window.dispatchEvent(new CustomEvent("open-command-palette"));
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" || e.key === " ") {
      handleClick();
    }
  }

  return (
    <div
      className={cn("glass-panel rounded-xl p-1", className)}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      <div className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/60 px-3 py-2 text-muted-foreground">
        <SearchIcon className="size-4" />
        <span className="text-xs">⌘K</span>
        <span className="ml-1 text-xs opacity-60">{placeholder}</span>
      </div>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";
import type { InspectorMessage } from "@/src/types/inspector";

const ROLE_ICON: Record<string, { icon: string; className: string }> = {
  system: { icon: "S", className: "bg-violet-500/20 text-violet-300 border-violet-500/30" },
  user: { icon: "U", className: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  assistant: { icon: "A", className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30" },
  tool: { icon: "T", className: "bg-amber-500/20 text-amber-300 border-amber-500/30" },
};

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

interface MessageListProps {
  messages: InspectorMessage[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  compact?: boolean;
}

export function MessageList({ messages, selectedIndex, onSelect, compact = false }: MessageListProps) {
  if (messages.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border/60 bg-background/20 px-3 py-4 text-center text-xs text-muted-foreground">
        Transcript not available
      </div>
    );
  }

  return (
    <div className="space-y-0.5">
      {messages.map((msg) => {
        const roleInfo = ROLE_ICON[msg.role] ?? ROLE_ICON.assistant;
        const isSelected = selectedIndex === msg.index;
        const totalTokens = msg.tokensIn + msg.tokensOut;

        return (
          <button
            key={msg.index}
            onClick={() => onSelect(msg.index)}
            data-message-index={msg.index}
            className={cn(
              "flex w-full items-start gap-2 rounded-md border px-2 py-1.5 text-left text-[11px] transition-colors",
              isSelected
                ? "border-accent/50 bg-accent/10"
                : "border-border/40 bg-background/25 hover:border-border/60 hover:bg-background/40",
            )}
          >
            <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[9px] font-bold", roleInfo.className)}>
              {roleInfo.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <span className="font-medium text-foreground">{msg.role}</span>
                {totalTokens > 0 && (
                  <span className="shrink-0 text-muted-foreground">
                    {formatTokens(totalTokens)} tok
                  </span>
                )}
              </div>
              {!compact && (
                <p className="mt-0.5 line-clamp-1 text-muted-foreground">
                  {msg.content || "(empty)"}
                </p>
              )}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-0.5 space-y-0.5">
                  {msg.toolCalls.map((tc, i) => (
                    <span
                      key={i}
                      className="mr-1 inline-flex items-center rounded border border-amber-500/20 bg-amber-500/10 px-1 py-0.5 text-[9px] text-amber-200"
                    >
                      {tc.name}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

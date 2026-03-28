"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ToolCallInfo } from "@/src/types/inspector";

interface ToolCallViewProps {
  toolCall: ToolCallInfo;
}

function tryFormatJson(str: string): string {
  try {
    return JSON.stringify(JSON.parse(str), null, 2);
  } catch {
    return str;
  }
}

export function ToolCallView({ toolCall }: ToolCallViewProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="rounded-md border border-border/50 bg-background/25">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-1.5 px-2 py-1.5 text-left text-[11px] transition-colors hover:bg-background/40"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
        )}
        <span className="font-medium text-amber-200">{toolCall.name}</span>
      </button>

      {expanded && (
        <div className="space-y-2 border-t border-border/40 px-2 py-1.5">
          {toolCall.arguments && (
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Arguments</div>
              <pre className={cn(
                "max-h-32 overflow-auto rounded border border-border/40 bg-background/30 p-1.5 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-words",
              )}>
                {tryFormatJson(toolCall.arguments)}
              </pre>
            </div>
          )}
          {toolCall.resultPreview && (
            <div>
              <div className="mb-0.5 text-[10px] font-medium text-muted-foreground">Result</div>
              <pre className="max-h-24 overflow-auto rounded border border-border/40 bg-background/30 p-1.5 font-mono text-[10px] text-muted-foreground whitespace-pre-wrap break-words">
                {toolCall.resultPreview}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

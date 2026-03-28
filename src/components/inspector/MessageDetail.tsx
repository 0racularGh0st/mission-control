"use client";

/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InspectorMessage, InspectorSource } from "@/src/types/inspector";
import { ToolCallView } from "./ToolCallView";

interface MessageDetailProps {
  message: InspectorMessage;
  source: InspectorSource;
  inspectId: string;
  onClose: () => void;
}

export function MessageDetail({ message, source, inspectId, onClose }: MessageDetailProps) {
  const [fullContent, setFullContent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const displayContent = useMemo(() => fullContent ?? message.content, [fullContent, message.content]);

  useEffect(() => {
    if (!message.fullContent) return;

    let cancelled = false;

    // If this is a new message, clear previous fetched content.
    setFullContent(null);
    setLoading(true);

    fetch(`/api/inspect/${source}/${inspectId}/message/${message.index}`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        setFullContent(data.content ?? message.content);
      })
      .catch(() => {
        if (cancelled) return;
        setFullContent(message.fullContent ?? message.content);
      })
      .finally(() => {
        if (cancelled) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [message.index, message.fullContent, message.content, source, inspectId]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground capitalize">{message.role}</span>
          <span className="text-[11px] text-muted-foreground">#{message.index}</span>
          {message.tokensIn + message.tokensOut > 0 && (
            <span className="text-[11px] text-muted-foreground">
              {message.tokensIn > 0 && `${message.tokensIn} in`}
              {message.tokensIn > 0 && message.tokensOut > 0 && " / "}
              {message.tokensOut > 0 && `${message.tokensOut} out`}
            </span>
          )}
          {message.costUsd > 0 && (
            <span className="text-[11px] text-muted-foreground">${message.costUsd.toFixed(4)}</span>
          )}
        </div>
        <button
          onClick={onClose}
          className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      <div>
        <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Content</div>
        {loading ? (
          <div className="rounded-md border border-border/60 bg-background/35 p-2 text-[11px] text-muted-foreground">
            Loading full content...
          </div>
        ) : (
          <pre
            className={cn(
              "max-h-64 overflow-auto rounded-md border border-border/60 bg-background/35 p-2 font-mono text-[11px] text-muted-foreground whitespace-pre-wrap break-words"
            )}
          >
            {displayContent || "(empty)"}
          </pre>
        )}
      </div>

      {message.toolCalls?.length ? (
        <div>
          <div className="mb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Tool calls</div>
          <div className="space-y-2">
            {message.toolCalls.map((tc, i) => (
              <ToolCallView key={i} toolCall={tc} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

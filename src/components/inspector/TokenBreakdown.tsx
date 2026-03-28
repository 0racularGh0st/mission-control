"use client";

import { cn } from "@/lib/utils";

interface TokenBreakdownProps {
  tokensIn: number;
  tokensOut: number;
  tokensCache: number;
  compact?: boolean;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return String(n);
}

export function TokenBreakdown({ tokensIn, tokensOut, tokensCache, compact = false }: TokenBreakdownProps) {
  const total = tokensIn + tokensOut + tokensCache;
  if (total === 0) return null;

  const inPct = (tokensIn / total) * 100;
  const outPct = (tokensOut / total) * 100;
  const cachePct = (tokensCache / total) * 100;

  return (
    <div className={cn("space-y-1.5", compact && "space-y-1")}>
      {/* Bar chart */}
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-background/40">
        {tokensIn > 0 && (
          <div
            className="bg-blue-400/70 transition-all"
            style={{ width: `${inPct}%` }}
            title={`Input: ${formatTokens(tokensIn)}`}
          />
        )}
        {tokensOut > 0 && (
          <div
            className="bg-emerald-400/70 transition-all"
            style={{ width: `${outPct}%` }}
            title={`Output: ${formatTokens(tokensOut)}`}
          />
        )}
        {tokensCache > 0 && (
          <div
            className="bg-amber-400/50 transition-all"
            style={{ width: `${cachePct}%` }}
            title={`Cache: ${formatTokens(tokensCache)}`}
          />
        )}
      </div>

      {/* Legend */}
      <div className={cn("flex flex-wrap gap-x-3 gap-y-0.5 text-[11px]", compact && "text-[10px]")}>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-blue-400/70" />
          <span className="text-muted-foreground">In: {formatTokens(tokensIn)}</span>
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full bg-emerald-400/70" />
          <span className="text-muted-foreground">Out: {formatTokens(tokensOut)}</span>
        </span>
        {tokensCache > 0 && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-full bg-amber-400/50" />
            <span className="text-muted-foreground">Cache: {formatTokens(tokensCache)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import { Loader2, ScanSearch } from "lucide-react";
import type { MemoryScanResult } from "@/src/types/memory";

interface MemoryScanButtonProps {
  scanning: boolean;
  scanResult: MemoryScanResult | null;
  onScan: () => void;
}

export function MemoryScanButton({ scanning, scanResult, onScan }: MemoryScanButtonProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={scanning}
        onClick={onScan}
        className="flex items-center gap-1.5 rounded-md border border-border/60 bg-background/35 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/30 hover:text-foreground disabled:opacity-50"
      >
        {scanning ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <ScanSearch className="size-3.5" />
        )}
        {scanning ? "Scanning\u2026" : "Scan"}
      </button>

      {scanResult && !scanning && (
        <span className="text-[10px] text-muted-foreground">
          +{scanResult.added} added, {scanResult.updated} updated, {scanResult.removed} removed
        </span>
      )}
    </div>
  );
}

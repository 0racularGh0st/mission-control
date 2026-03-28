import { NextResponse } from "next/server";
import { scanMemories } from "@/src/server/memoryScanner";
import { emitMemoryEvent } from "@/src/runtime/memory/eventsBus";
import { recordEvent } from "@/src/server/timeline";

export const dynamic = "force-dynamic";

let scanning = false;

export async function POST() {
  if (scanning) {
    return NextResponse.json(
      { error: "Scan already in progress" },
      { status: 409 },
    );
  }

  try {
    scanning = true;
    const result = scanMemories();

    emitMemoryEvent({ type: "memory.scanned", result });
    recordEvent(
      "memory.scanned",
      "agents",
      "",
      "system",
      `Memory scan complete: ${result.added} added, ${result.updated} updated, ${result.removed} removed`,
      JSON.stringify(result),
    );

    return NextResponse.json({ result }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Memory scan failed", detail: String(error) },
      { status: 500 },
    );
  } finally {
    scanning = false;
  }
}

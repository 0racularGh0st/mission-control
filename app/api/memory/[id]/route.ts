import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMemoryEntry, deleteMemoryEntry } from "@/src/server/memoryScanner";
import { emitMemoryEvent } from "@/src/runtime/memory/eventsBus";
import { recordEvent } from "@/src/server/timeline";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entry = getMemoryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Memory entry not found" }, { status: 404 });
  }
  return NextResponse.json({ entry });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const entry = getMemoryEntry(id);
  if (!entry) {
    return NextResponse.json({ error: "Memory entry not found" }, { status: 404 });
  }

  const deleted = deleteMemoryEntry(id);
  if (!deleted) {
    return NextResponse.json({ error: "Failed to delete memory entry" }, { status: 500 });
  }

  emitMemoryEvent({ type: "memory.deleted", entryId: id });
  recordEvent(
    "memory.deleted",
    "agents",
    id,
    "system",
    `Memory deleted: ${entry.name}`,
    JSON.stringify({ memType: entry.memType, agent: entry.agent }),
  );

  return NextResponse.json({ success: true });
}

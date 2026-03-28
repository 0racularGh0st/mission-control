import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getMemoryEntries, getMemoryGraph, scanMemories } from "@/src/server/memoryScanner";
import type { MemoryType } from "@/src/types/memory";
import { MEMORY_TYPES } from "@/src/types/memory";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const url = new URL(req.url);
    const format = url.searchParams.get("format") ?? "list";
    const agent = url.searchParams.get("agent") ?? undefined;
    const memType = url.searchParams.get("type") as MemoryType | null;
    const search = url.searchParams.get("search") ?? undefined;

    if (memType && !MEMORY_TYPES.includes(memType)) {
      return NextResponse.json(
        { error: `Invalid type: ${memType}. Must be one of: ${MEMORY_TYPES.join(", ")}` },
        { status: 400 },
      );
    }

    const options = {
      agent,
      memType: memType ?? undefined,
      search,
    };

    if (format === "graph") {
      const graph = getMemoryGraph(options);
      return NextResponse.json(graph);
    }

    const result = getMemoryEntries(options);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to query memory entries", detail: String(error) },
      { status: 500 },
    );
  }
}

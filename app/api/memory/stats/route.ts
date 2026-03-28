import { NextResponse } from "next/server";
import { getMemoryStats } from "@/src/server/memoryScanner";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const stats = getMemoryStats();
    return NextResponse.json(stats);
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to get memory stats", detail: String(error) },
      { status: 500 },
    );
  }
}

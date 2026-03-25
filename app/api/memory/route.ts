import { NextResponse } from "next/server";
import { readMemoryFiles } from "@/src/server/memoryReader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const entries = await readMemoryFiles(false);
    return NextResponse.json({ entries }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read memory files", detail: String(error) },
      { status: 500 },
    );
  }
}

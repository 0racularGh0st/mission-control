import { type NextRequest, NextResponse } from "next/server";
import { getMessageFullContent } from "@/src/server/inspector";
import { INSPECTOR_SOURCES, type InspectorSource } from "@/src/types/inspector";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source: string; id: string; index: string }> },
) {
  const { source, id, index } = await params;

  if (!INSPECTOR_SOURCES.includes(source as InspectorSource)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${INSPECTOR_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  const messageIndex = parseInt(index, 10);
  if (isNaN(messageIndex) || messageIndex < 0) {
    return NextResponse.json({ error: "Invalid message index" }, { status: 400 });
  }

  const result = getMessageFullContent(source as InspectorSource, id, messageIndex);

  if (!result) {
    return NextResponse.json(
      { error: "Message not found" },
      { status: 404 },
    );
  }

  return NextResponse.json(result);
}

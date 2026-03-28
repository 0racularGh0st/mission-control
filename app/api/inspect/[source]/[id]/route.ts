import { type NextRequest, NextResponse } from "next/server";
import { getInspectorData } from "@/src/server/inspector";
import { INSPECTOR_SOURCES, type InspectorSource } from "@/src/types/inspector";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ source: string; id: string }> },
) {
  const { source, id } = await params;

  if (!INSPECTOR_SOURCES.includes(source as InspectorSource)) {
    return NextResponse.json(
      { error: `Invalid source. Must be one of: ${INSPECTOR_SOURCES.join(", ")}` },
      { status: 400 },
    );
  }

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const data = getInspectorData(source as InspectorSource, id);

  if (!data) {
    return NextResponse.json(
      { error: `No ${source} entry found for id: ${id}` },
      { status: 404 },
    );
  }

  return NextResponse.json(data);
}

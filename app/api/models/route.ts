import { NextResponse } from "next/server";
import { getModelRoutingVisualization } from "@/src/server/routingReader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const viz = await getModelRoutingVisualization();
    return NextResponse.json(viz, { status: 200 });
  } catch (error) {
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { readAgents } from "@/src/server/agentsReader";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await readAgents();
  return NextResponse.json({ agents });
}

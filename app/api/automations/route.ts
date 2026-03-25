import { NextResponse } from "next/server";
import { readAutomations } from "@/src/server/automationReader";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const automations = await readAutomations();
    return NextResponse.json({ automations }, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to read automations", detail: String(error) },
      { status: 500 },
    );
  }
}

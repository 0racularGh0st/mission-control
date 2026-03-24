import { NextResponse } from "next/server";

import { getDashboardSnapshot } from "@/src/runtime/dashboard/adapters";

export async function GET() {
  try {
    const snapshot = await getDashboardSnapshot();
    return NextResponse.json(snapshot, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to resolve dashboard runtime snapshot",
        detail: String(error),
      },
      { status: 500 },
    );
  }
}

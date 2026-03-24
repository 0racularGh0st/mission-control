import { NextResponse } from "next/server";

import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const cursor = searchParams.get("cursor") ?? undefined;

    const runtimeState = await getDashboardRuntimeState(cursor);
    return NextResponse.json(runtimeState, { status: 200 });
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

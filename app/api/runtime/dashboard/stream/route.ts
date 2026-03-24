import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let cursor = searchParams.get("cursor") ?? request.headers.get("last-event-id") ?? undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let inflight = false;
      let sentInitialSnapshot = false;

      const sendRuntimeEvent = async () => {
        if (closed || inflight) {
          return;
        }

        inflight = true;
        try {
          const runtimeState = await getDashboardRuntimeState(cursor);

          if (!sentInitialSnapshot) {
            sentInitialSnapshot = true;
            controller.enqueue(
              encoder.encode(
                `id: ${runtimeState.cursor}\nevent: snapshot\ndata: ${JSON.stringify({
                  cursor: runtimeState.cursor,
                  source: runtimeState.source,
                  transport: runtimeState.transport,
                  snapshot: runtimeState.snapshot,
                })}\n\n`,
              ),
            );
          }

          if (runtimeState.updates.length > 0) {
            for (const patch of runtimeState.updates) {
              controller.enqueue(
                encoder.encode(`id: ${patch.cursor}\nevent: patch\ndata: ${JSON.stringify(patch)}\n\n`),
              );
            }
          } else {
            controller.enqueue(
              encoder.encode(
                `id: ${runtimeState.cursor}\nevent: runtime\ndata: ${JSON.stringify({
                  cursor: runtimeState.cursor,
                  source: runtimeState.source,
                  transport: runtimeState.transport,
                  recommendedPollMs: runtimeState.recommendedPollMs,
                })}\n\n`,
              ),
            );
          }

          cursor = runtimeState.cursor;
        } catch (error) {
          controller.enqueue(
            encoder.encode(
              `event: error\ndata: ${JSON.stringify({ error: "dashboard-stream-failed", detail: String(error) })}\n\n`,
            ),
          );
        } finally {
          inflight = false;
        }
      };

      void sendRuntimeEvent();
      const interval = setInterval(() => {
        void sendRuntimeEvent();
      }, 2_000);

      request.signal.addEventListener("abort", () => {
        if (closed) {
          return;
        }
        closed = true;
        clearInterval(interval);
        controller.close();
      });
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

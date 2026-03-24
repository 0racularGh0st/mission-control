import { getDashboardRuntimeState } from "@/src/runtime/dashboard/adapters";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  let cursor = searchParams.get("cursor") ?? undefined;

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let inflight = false;

      const sendRuntimeEvent = async () => {
        if (closed || inflight) {
          return;
        }

        inflight = true;
        try {
          const runtimeState = await getDashboardRuntimeState(cursor);
          cursor = runtimeState.cursor;
          controller.enqueue(encoder.encode(`event: runtime\ndata: ${JSON.stringify(runtimeState)}\n\n`));
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

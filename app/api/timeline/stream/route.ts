import { subscribeToTimelineEvents } from "@/src/runtime/timeline/eventsBus";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const unsubscribe = subscribeToTimelineEvents((event) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: timeline\ndata: ${JSON.stringify(event)}\n\n`),
          );
        } catch {
          // connection may already be closed
        }
      });

      request.signal.addEventListener("abort", () => {
        if (closed) return;
        closed = true;
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
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

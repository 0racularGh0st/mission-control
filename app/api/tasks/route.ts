import { type NextRequest, NextResponse } from "next/server";
import { createTask, deleteTask, getTasks, moveTask, updateTask, TASK_LANES, TASK_ASSIGNEES } from "@/src/runtime/tasks/store";
import type { TaskLane, TaskAssignee } from "@/src/runtime/tasks/store";

export const dynamic = "force-dynamic";

export async function GET() {
  const tasks = getTasks();
  return NextResponse.json({ tasks });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { title, lane, status, assignee, priority, summary, detail, model, etaMinutes, blockingReason } = body;

    if (!title || !lane || !status || !assignee || !priority) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!TASK_LANES.includes(lane as TaskLane)) {
      return NextResponse.json({ error: `Invalid lane. Must be one of: ${TASK_LANES.join(", ")}` }, { status: 400 });
    }

    if (!TASK_ASSIGNEES.includes(assignee as TaskAssignee)) {
      return NextResponse.json({ error: `Invalid assignee. Must be one of: ${TASK_ASSIGNEES.join(", ")}` }, { status: 400 });
    }

    const task = createTask({ title, lane: lane as TaskLane, status, assignee: assignee as TaskAssignee, priority, summary: summary ?? "", detail: detail ?? "", model: model ?? "MiniMax-M2.7", etaMinutes: etaMinutes ?? null, blockingReason });
    return NextResponse.json({ task }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { id, action } = body;
    if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

    if (action === "move") {
      const { lane } = body as { id: string; action: "move"; lane: TaskLane };
      if (!TASK_LANES.includes(lane as TaskLane)) {
        return NextResponse.json({ error: `Invalid lane. Must be one of: ${TASK_LANES.join(", ")}` }, { status: 400 });
      }
      const task = moveTask(id, lane as TaskLane);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ task });
    }

    if (action === "update") {
      const updates = body as { id: string; action: string; [key: string]: unknown };
      if (updates.lane !== undefined && !TASK_LANES.includes(updates.lane as TaskLane)) {
        return NextResponse.json({ error: `Invalid lane. Must be one of: ${TASK_LANES.join(", ")}` }, { status: 400 });
      }
      if (updates.assignee !== undefined && !TASK_ASSIGNEES.includes(updates.assignee as TaskAssignee)) {
        return NextResponse.json({ error: `Invalid assignee. Must be one of: ${TASK_ASSIGNEES.join(", ")}` }, { status: 400 });
      }
      const task = updateTask(id, updates as Parameters<typeof updateTask>[1]);
      if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });
      return NextResponse.json({ task });
    }

    return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) return NextResponse.json({ error: "Missing task id" }, { status: 400 });

  const deleted = deleteTask(id);
  if (!deleted) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  return NextResponse.json({ success: true });
}

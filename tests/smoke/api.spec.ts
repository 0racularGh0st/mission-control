import { test, expect, request } from "@playwright/test";

/**
 * Smoke tests for /api/tasks CRUD endpoints.
 */
test.describe("Tasks API", () => {
  test("GET /api/tasks returns JSON with tasks array", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const response = await ctx.get("/api/tasks");
    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toHaveProperty("tasks");
    expect(Array.isArray(body.tasks)).toBe(true);
    expect(body.tasks.length).toBeGreaterThan(0);

    // Spot-check a task shape
    const task = body.tasks[0];
    expect(task).toHaveProperty("id");
    expect(task).toHaveProperty("title");
    expect(task).toHaveProperty("lane");
    expect(task).toHaveProperty("status");
    expect(task).toHaveProperty("assignee");
    expect(task).toHaveProperty("priority");
  });

  test("POST /api/tasks creates a new task and returns it", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });

    const newTask = {
      title: "Smoke test task",
      lane: "next",
      status: "queued",
      assignee: "Tester",
      priority: "P2",
      summary: "Created by smoke test",
      detail: "Should be cleaned up automatically.",
      model: "MiniMax-M2.7",
      etaMinutes: 5,
    };

    const response = await ctx.post("/api/tasks", { data: newTask });
    expect(response.status()).toBe(201);

    const body = await response.json();
    expect(body).toHaveProperty("task");
    const task = body.task;
    expect(task.id).toMatch(/^T-\d+$/);
    expect(task.title).toBe(newTask.title);
    expect(task.lane).toBe(newTask.lane);
    expect(task.status).toBe(newTask.status);
    expect(task.assignee).toBe(newTask.assignee);
    expect(task.priority).toBe(newTask.priority);
    expect(task.summary).toBe(newTask.summary);
    expect(task.detail).toBe(newTask.detail);
    expect(task.model).toBe(newTask.model);
    expect(task.etaMinutes).toBe(newTask.etaMinutes);
    expect(task).toHaveProperty("createdAt");
    expect(task).toHaveProperty("updatedAt");
  });

  test("POST /api/tasks rejects request with missing required fields", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });

    const response = await ctx.post("/api/tasks", {
      data: { title: "Only title" },
    });
    expect(response.status()).toBe(400);
  });

  test("PATCH /api/tasks moves a task to a new lane", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });

    // Get current tasks
    const getResp = await ctx.get("/api/tasks");
    const { tasks } = await getResp.json();
    const taskToMove = tasks.find((t: { lane: string }) => t.lane !== "done");
    expect(taskToMove).toBeDefined();

    const patchResp = await ctx.patch("/api/tasks", {
      data: { id: taskToMove.id, action: "move", lane: "done" },
    });
    expect(patchResp.status()).toBe(200);
    const { task } = await patchResp.json();
    expect(task.lane).toBe("done");
    expect(task.status).toBe("done");
  });

  test("DELETE /api/tasks removes a task", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });

    // Create a task to delete
    const createResp = await ctx.post("/api/tasks", {
      data: {
        title: "Task to delete",
        lane: "next",
        status: "queued",
        assignee: "Tester",
        priority: "P3",
      },
    });
    const { task } = await createResp.json();

    const deleteResp = await ctx.delete(`/api/tasks?id=${task.id}`);
    expect(deleteResp.status()).toBe(200);
  });

  test("DELETE /api/tasks returns 400 when id is missing", async ({ baseURL }) => {
    const ctx = await request.newContext({ baseURL });
    const response = await ctx.delete("/api/tasks");
    expect(response.status()).toBe(400);
  });
});

import { describe, expect, it, beforeAll, afterAll, vi } from "vitest";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildServer } from "@/server";
import { TaskRunner } from "@/runner/task-runner";
import { SessionStore } from "@/storage/sessions";
import type { FastifyInstance } from "fastify";

describe("server e2e", () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    const baseDir = mkdtempSync(join(tmpdir(), "dp-srv-"));
    const store = new SessionStore(baseDir);
    const taskRunner = new TaskRunner({
      store,
      agentLoop: vi.fn().mockResolvedValue({ completed: true, reason: "end_turn", iterations: 0 }),
      recorder: { start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), recordAction: vi.fn() },
      maxActionsPerSecond: 3,
      timeBudgetMs: 5_000,
    });
    app = await buildServer({ baseDir, port: 0, taskRunnerOverride: taskRunner });
  });

  afterAll(async () => {
    await app.close();
  });

  it("POST /task creates a session and returns id+status", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/task",
      payload: { prompt: "test prompt" },
    });
    expect(res.statusCode).toBe(202);
    const body = JSON.parse(res.body);
    expect(body.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(body.status).toBe("queued");
  });

  it("GET /status/:id returns session metadata", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/task",
      payload: { prompt: "for status" },
    });
    const id = JSON.parse(create.body).id;
    const res = await app.inject({ method: "GET", url: `/status/${id}` });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.id).toBe(id);
    expect(body.prompt).toBe("for status");
  });

  it("GET /status/:id 404s for unknown id", async () => {
    const res = await app.inject({ method: "GET", url: "/status/00000000-0000-0000-0000-000000000000" });
    expect(res.statusCode).toBe(404);
  });

  it("POST /abort/:id returns aborted=true for known session", async () => {
    const create = await app.inject({
      method: "POST",
      url: "/task",
      payload: { prompt: "to abort" },
    });
    const id = JSON.parse(create.body).id;
    const res = await app.inject({ method: "POST", url: `/abort/${id}` });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).aborted).toBe(true);
  });
});

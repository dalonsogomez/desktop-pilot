import { describe, expect, it, vi, beforeEach } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { SessionStore } from "@/storage/sessions";
import { TaskRunner } from "@/runner/task-runner";

describe("TaskRunner", () => {
  let baseDir: string;
  let store: SessionStore;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "dp-tr-"));
    store = new SessionStore(baseDir);
  });

  it("runs a session and writes metrics.json on completion", async () => {
    const sess = await store.create({ prompt: "test" });
    const runner = new TaskRunner({
      store,
      agentLoop: vi.fn().mockResolvedValue({ completed: true, reason: "end_turn", iterations: 2 }),
      recorderFactory: () => ({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), recordAction: vi.fn() }),
      maxActionsPerSecond: 3,
      timeBudgetMs: 60_000,
    });
    await runner.runSession(sess.id);
    const metrics = JSON.parse(readFileSync(join(baseDir, sess.id, "metrics.json"), "utf8"));
    expect(metrics.completed).toBe(true);
    expect(metrics.iterations).toBe(2);
    expect(metrics.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("aborts on signal and persists status", async () => {
    const sess = await store.create({ prompt: "abortable" });
    const runner = new TaskRunner({
      store,
      agentLoop: () => new Promise((resolve) => {
        setTimeout(() => resolve({ completed: false, reason: "aborted", iterations: 1 }), 100);
      }),
      recorderFactory: () => ({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined), recordAction: vi.fn() }),
      maxActionsPerSecond: 3,
      timeBudgetMs: 60_000,
    });
    const promise = runner.runSession(sess.id);
    setTimeout(() => runner.abort(sess.id), 50);
    await promise;
    const metrics = JSON.parse(readFileSync(join(baseDir, sess.id, "metrics.json"), "utf8"));
    expect(metrics.completed).toBe(false);
    expect(metrics.reason).toBe("aborted");
  });
});

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { SessionStore } from "@/storage/sessions";
import { RateLimiter } from "@/runner/rate-limit";
import type { AgentLoopInput, AgentLoopResult } from "@/agent/runner";

export interface RecorderHandle {
  start(): Promise<void>;
  stop(): Promise<void>;
  recordAction(index: number, screenshot?: string): void;
}

export interface TaskRunnerOptions {
  store: SessionStore;
  agentLoop: (input: AgentLoopInput) => Promise<AgentLoopResult>;
  recorder: RecorderHandle;
  maxActionsPerSecond: number;
  timeBudgetMs: number;
}

export class TaskRunner {
  private aborted = new Set<string>();

  constructor(private opts: TaskRunnerOptions) {}

  async runSession(sessionId: string): Promise<void> {
    const start = Date.now();
    const dir = this.opts.store.sessionDir(sessionId);
    const rateLimiter = new RateLimiter({ maxPerSecond: this.opts.maxActionsPerSecond });
    let actionCount = 0;

    await this.opts.recorder.start();

    let result: AgentLoopResult;
    try {
      result = await this.opts.agentLoop({
        prompt: "",
        client: undefined as never,
        tools: [],
        timeoutMs: this.opts.timeBudgetMs,
        onAction: async (action) => {
          if (this.aborted.has(sessionId)) {
            throw new Error("aborted");
          }
          await rateLimiter.acquire();
          actionCount++;
          this.opts.recorder.recordAction(actionCount, undefined);
          await this.opts.store.appendTranscript(sessionId, {
            type: "action",
            index: actionCount,
            name: action.name,
            input: action.input,
            timestamp: new Date().toISOString(),
          });
        },
      });
    } catch (err) {
      result = {
        completed: false,
        reason: this.aborted.has(sessionId) ? "aborted" : "error",
        iterations: actionCount,
      };
    } finally {
      await this.opts.recorder.stop();
    }

    const metrics = {
      sessionId,
      completed: result.completed,
      reason: result.reason,
      iterations: result.iterations,
      actionCount,
      durationMs: Date.now() - start,
      finishedAt: new Date().toISOString(),
    };
    await writeFile(join(dir, "metrics.json"), JSON.stringify(metrics, null, 2));
  }

  abort(sessionId: string): void {
    this.aborted.add(sessionId);
  }
}

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
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
  recorderFactory: (sessionDir: string) => RecorderHandle;
  client: Anthropic | { messages: { create: (...args: any[]) => Promise<any> } };
  tools: any[];
  systemPrompt: string;
  toolDispatcher: (name: string, input: unknown) => Promise<string>;
  maxActionsPerSecond: number;
  timeBudgetMs: number;
}

function tryParseJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return s; }
}

export class TaskRunner {
  private aborted = new Set<string>();

  constructor(private opts: TaskRunnerOptions) {}

  async runSession(sessionId: string): Promise<void> {
    const start = Date.now();
    const rateLimiter = new RateLimiter({ maxPerSecond: this.opts.maxActionsPerSecond });
    let actionCount = 0;

    const session = await this.opts.store.get(sessionId);
    const recorder = this.opts.recorderFactory(this.opts.store.sessionDir(sessionId));
    await recorder.start();

    await this.opts.store.appendTranscript(sessionId, {
      type: "prompt",
      content: session.prompt,
      timestamp: new Date().toISOString(),
    });

    let result: AgentLoopResult;
    try {
      result = await this.opts.agentLoop({
        prompt: session.prompt,
        client: this.opts.client,
        tools: this.opts.tools,
        systemPrompt: this.opts.systemPrompt,
        timeoutMs: this.opts.timeBudgetMs,
        onTool: async (action) => {
          if (this.aborted.has(sessionId)) {
            throw new Error("aborted");
          }
          await rateLimiter.acquire();
          actionCount++;
          recorder.recordAction(actionCount, undefined);
          const resultContent = await this.opts.toolDispatcher(action.name, action.input);
          await this.opts.store.appendTranscript(sessionId, {
            type: "tool",
            index: actionCount,
            name: action.name,
            input: action.input,
            result: tryParseJson(resultContent),
            timestamp: new Date().toISOString(),
          });
          return resultContent;
        },
      });
    } catch (err) {
      result = {
        completed: false,
        reason: this.aborted.has(sessionId) ? "aborted" : "error",
        iterations: actionCount,
      };
    } finally {
      await recorder.stop();
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
    await writeFile(join(this.opts.store.sessionDir(sessionId), "metrics.json"), JSON.stringify(metrics, null, 2));
  }

  abort(sessionId: string): void {
    this.aborted.add(sessionId);
  }
}

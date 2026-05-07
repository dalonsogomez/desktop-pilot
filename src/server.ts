import Fastify, { FastifyInstance } from "fastify";
import { SessionStore } from "@/storage/sessions";
import { TaskRunner } from "@/runner/task-runner";
import { RecorderController } from "@/recorder/controller";
import { runAgentLoop } from "@/agent/runner";
import { taskRoute } from "@/routes/task";
import { statusRoute } from "@/routes/status";
import { transcriptRoute } from "@/routes/transcript";
import { abortRoute } from "@/routes/abort";
import { metricsRoute } from "@/routes/metrics";

export interface ServerOptions {
  baseDir: string;
  port: number;
  recorderBinary?: string;
  apiKey?: string;
  maxActionsPerSecond?: number;
  timeBudgetMs?: number;
  taskRunnerOverride?: TaskRunner;  // for tests
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = new SessionStore(opts.baseDir);

  let taskRunner: TaskRunner;
  if (opts.taskRunnerOverride) {
    taskRunner = opts.taskRunnerOverride;
  } else {
    const binaryPath = opts.recorderBinary ?? "/usr/local/bin/screen-recorder";
    taskRunner = new TaskRunner({
      store,
      agentLoop: runAgentLoop,
      recorderFactory: (sessionDir) => new RecorderController({ binaryPath, sessionDir }),
      maxActionsPerSecond: opts.maxActionsPerSecond ?? 3,
      timeBudgetMs: opts.timeBudgetMs ?? 5 * 60_000,
    });
  }

  app.decorate("store", store);
  app.decorate("taskRunner", taskRunner);

  await app.register(taskRoute);
  await app.register(statusRoute);
  await app.register(transcriptRoute);
  await app.register(abortRoute);
  await app.register(metricsRoute);
  await app.listen({ port: opts.port, host: "127.0.0.1" });
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    store: SessionStore;
    taskRunner: TaskRunner;
  }
}

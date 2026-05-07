import Fastify, { FastifyInstance } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import { SessionStore } from "@/storage/sessions";
import { TaskRunner } from "@/runner/task-runner";
import { RecorderController } from "@/recorder/controller";
import { runAgentLoop } from "@/agent/runner";
import { SYSTEM_PROMPT } from "@/agent/system-prompt";
import { ALL_TOOLS, dispatchTool } from "@/agent/tools";
import { AppleScriptGuard } from "@/guards/applescript-checks";
import { getSecret } from "@/storage/keychain";
import { taskRoute } from "@/routes/task";
import { statusRoute } from "@/routes/status";
import { transcriptRoute } from "@/routes/transcript";
import { abortRoute } from "@/routes/abort";
import { metricsRoute } from "@/routes/metrics";

export interface ServerOptions {
  baseDir: string;
  port: number;
  recorderBinary?: string;
  apiKey?: string;  // if not provided, reads from Keychain
  applescriptAllowlistPath?: string;
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
    let apiKey = opts.apiKey;
    if (!apiKey) {
      try {
        apiKey = await getSecret("ai.desktop-pilot.anthropic", "default");
      } catch {
        throw new Error(
          "No Anthropic API key found in Keychain (ai.desktop-pilot.anthropic / default). Run bootstrap.sh or pass apiKey option."
        );
      }
    }
    const client = new Anthropic({ apiKey });
    const allowlistPath =
      opts.applescriptAllowlistPath ??
      `${process.env.HOME}/.config/desktop-pilot/applescript-allowlist.yaml`;
    const appleScriptGuard = new AppleScriptGuard(allowlistPath);
    taskRunner = new TaskRunner({
      store,
      agentLoop: runAgentLoop,
      recorderFactory: (sessionDir) =>
        new RecorderController({
          binaryPath: opts.recorderBinary ?? "/usr/local/bin/screen-recorder",
          sessionDir,
        }),
      client,
      tools: ALL_TOOLS,
      systemPrompt: SYSTEM_PROMPT,
      toolDispatcher: (name, input) => dispatchTool(name, input, { appleScriptGuard }),
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

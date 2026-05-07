import Fastify, { FastifyInstance } from "fastify";
import { SessionStore } from "@/storage/sessions";
import { taskRoute } from "@/routes/task";
import { statusRoute } from "@/routes/status";
import { transcriptRoute } from "@/routes/transcript";
import { abortRoute } from "@/routes/abort";

export interface ServerOptions {
  baseDir: string;
  port: number;
}

export async function buildServer(opts: ServerOptions): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const store = new SessionStore(opts.baseDir);
  app.decorate("store", store);
  await app.register(taskRoute);
  await app.register(statusRoute);
  await app.register(transcriptRoute);
  await app.register(abortRoute);
  await app.listen({ port: opts.port, host: "127.0.0.1" });
  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    store: SessionStore;
  }
}

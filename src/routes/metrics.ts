import { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function metricsRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/metrics/:id", async (req, reply) => {
    try {
      const dir = app.store.sessionDir(req.params.id);
      const raw = await readFile(join(dir, "metrics.json"), "utf8");
      return reply.status(200).send(JSON.parse(raw));
    } catch {
      return reply.status(404).send({ error: "not yet finished" });
    }
  });
}

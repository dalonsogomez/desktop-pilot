import { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function statusRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/status/:id", async (req, reply) => {
    try {
      const dir = app.store.sessionDir(req.params.id);
      const meta = JSON.parse(await readFile(join(dir, "metadata.json"), "utf8"));
      return reply.status(200).send(meta);
    } catch {
      return reply.status(404).send({ error: "session not found" });
    }
  });
}

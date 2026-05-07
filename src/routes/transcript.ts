import { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { join } from "node:path";

export async function transcriptRoute(app: FastifyInstance): Promise<void> {
  app.get<{ Params: { id: string } }>("/transcript/:id", async (req, reply) => {
    try {
      const dir = app.store.sessionDir(req.params.id);
      const raw = await readFile(join(dir, "transcript.jsonl"), "utf8");
      const entries = raw.trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
      return reply.status(200).send({ id: req.params.id, entries });
    } catch {
      return reply.status(404).send({ error: "transcript not found" });
    }
  });
}

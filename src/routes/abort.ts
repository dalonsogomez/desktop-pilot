import { FastifyInstance } from "fastify";

export async function abortRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>("/abort/:id", async (req, reply) => {
    try {
      app.store.sessionDir(req.params.id);
      return reply.status(200).send({ aborted: true });
    } catch {
      return reply.status(404).send({ error: "session not found" });
    }
  });
}

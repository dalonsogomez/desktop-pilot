import { FastifyInstance } from "fastify";

export async function taskRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Body: { prompt: string } }>("/task", async (req, reply) => {
    if (!req.body?.prompt) {
      return reply.status(400).send({ error: "prompt required" });
    }
    const session = await app.store.create({ prompt: req.body.prompt });
    return reply.status(202).send({ id: session.id, status: "queued" });
  });
}

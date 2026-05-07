import { FastifyInstance } from "fastify";

export async function abortRoute(app: FastifyInstance): Promise<void> {
  app.post<{ Params: { id: string } }>("/abort/:id", async (req, reply) => {
    if (!(await app.store.exists(req.params.id))) {
      return reply.status(404).send({ error: "session not found" });
    }
    app.taskRunner.abort(req.params.id);
    return reply.status(200).send({ aborted: true });
  });
}

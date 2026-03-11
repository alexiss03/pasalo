import { FastifyPluginAsync } from "fastify";

export const healthRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/health", async () => {
    return {
      ok: true,
      service: "pasalo-api",
      timestamp: new Date().toISOString(),
    };
  });
};

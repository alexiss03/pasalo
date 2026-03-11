import fp from "fastify-plugin";
import { FastifyPluginAsync } from "fastify";

const authPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate("authenticate", async (request) => {
    await request.jwtVerify();
  });

  fastify.decorate("authorizeRoles", (request, roles: string[]) => {
    if (!request.user || !roles.includes(request.user.role)) {
      throw fastify.httpErrors.forbidden("Insufficient role for this action");
    }
  });
};

export default fp(authPlugin);

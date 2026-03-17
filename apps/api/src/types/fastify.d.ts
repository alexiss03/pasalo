import "fastify";

declare module "fastify" {
  interface FastifyRequest {
    authenticate: () => Promise<void>;
    authorizeRoles: (roles: string[]) => void;
  }

  interface FastifyInstance {
    authenticate: (request: FastifyRequest) => Promise<void>;
    authorizeRoles: (request: FastifyRequest, roles: string[]) => void;
  }
}

declare module "@fastify/jwt" {
  interface FastifyJWT {
    user: {
      sub: string;
      role: "buyer" | "seller" | "agent" | "attorney" | "admin";
      email: string;
    };
  }
}

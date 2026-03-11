import Fastify from "fastify";
import cors from "@fastify/cors";
import jwt from "@fastify/jwt";
import sensible from "@fastify/sensible";
import { ZodError } from "zod";
import { env } from "./config/env";
import authPlugin from "./plugins/auth";
import { healthRoutes } from "./modules/health/routes";
import { authRoutes } from "./modules/auth/routes";
import { profileRoutes } from "./modules/profile/routes";
import { listingRoutes } from "./modules/listings/routes";
import { interactionRoutes } from "./modules/interactions/routes";
import { adminRoutes } from "./modules/admin/routes";

const app = Fastify({
  logger: true,
});

await app.register(cors, {
  origin: env.CORS_ORIGIN,
  credentials: true,
});

await app.register(sensible);

await app.register(jwt, {
  secret: env.JWT_SECRET,
});

await app.register(authPlugin);

await app.register(healthRoutes, { prefix: "/api/v1" });
await app.register(authRoutes, { prefix: "/api/v1" });
await app.register(profileRoutes, { prefix: "/api/v1" });
await app.register(listingRoutes, { prefix: "/api/v1" });
await app.register(interactionRoutes, { prefix: "/api/v1" });
await app.register(adminRoutes, { prefix: "/api/v1" });

app.setErrorHandler((error, _request, reply) => {
  app.log.error(error);

  const maybeZod = error as { name?: string; issues?: unknown[]; message?: string };
  const isZodLike =
    error instanceof ZodError ||
    maybeZod.name === "ZodError" ||
    (Array.isArray(maybeZod.issues) && maybeZod.issues.length > 0);

  if (isZodLike) {
    return reply.code(400).send({
      message: "Validation error",
      details: maybeZod.issues ?? maybeZod.message,
    });
  }

  const statusCode = (error as { statusCode?: number }).statusCode ?? 500;
  return reply.code(statusCode).send({
    message: error.message || "Internal server error",
  });
});

const start = async () => {
  try {
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

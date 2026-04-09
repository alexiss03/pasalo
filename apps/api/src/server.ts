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
import { uploadRoutes } from "./modules/uploads/routes";
import { pool } from "./db/pool";
import { hashPassword } from "./lib/password";
import { createSupabaseAuthUser } from "./lib/supabaseAuth";

const app = Fastify({
  logger: true,
  bodyLimit: 25 * 1024 * 1024,
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
await app.register(uploadRoutes, { prefix: "/api/v1" });

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
  const errorMessage = error instanceof Error ? error.message : "Internal server error";
  return reply.code(statusCode).send({
    message: errorMessage,
  });
});

const ensureDefaultAdmin = async () => {
  if (!env.ENABLE_DEFAULT_ADMIN) {
    app.log.info("Default admin bootstrap is disabled.");
    return;
  }

  const email = env.DEFAULT_ADMIN_EMAIL.trim().toLowerCase();

  if (env.AUTH_PROVIDER === "supabase") {
    try {
      await createSupabaseAuthUser({
        email,
        password: env.DEFAULT_ADMIN_PASSWORD,
        role: "admin",
        fullName: "Standard Admin",
        phone: "0000000000",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message.toLowerCase() : "";
      if (!message.includes("already") && !message.includes("exists") && !message.includes("registered")) {
        throw error;
      }
    }

    const client = await pool.connect();
    try {
      await client.query("begin");

      await client.query(
        `
        insert into users (email, password_hash, auth_provider, role)
        values ($1, null, 'supabase', 'admin')
        on conflict (email)
        do update set
          auth_provider = 'supabase',
          role = 'admin',
          updated_at = now()
        returning id
      `,
        [email],
      );
      const userResult = await client.query("select id from users where email = $1", [email]);
      const userId = userResult.rows[0].id as string;

      await client.query(
        `
        insert into profiles (user_id, full_name, phone, verification_status, verification_badge_shown)
        values ($1, 'Standard Admin', '0000000000', 'verified', true)
        on conflict (user_id)
        do update set
          full_name = coalesce(profiles.full_name, excluded.full_name),
          phone = coalesce(profiles.phone, excluded.phone),
          verification_status = 'verified',
          verification_badge_shown = true,
          updated_at = now()
      `,
        [userId],
      );

      await client.query("commit");
      app.log.info({ email }, "Default admin account is ready.");
      return;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  const passwordHash = await hashPassword(env.DEFAULT_ADMIN_PASSWORD);

  const client = await pool.connect();
  try {
    await client.query("begin");

    const userResult = await client.query(
      `
      insert into users (email, password_hash, auth_provider, role)
      values ($1, $2, 'email', 'admin')
      on conflict (email)
      do update set
        password_hash = excluded.password_hash,
        auth_provider = 'email',
        role = 'admin',
        updated_at = now()
      returning id, email
    `,
      [email, passwordHash],
    );

    const user = userResult.rows[0];

    await client.query(
      `
      insert into profiles (user_id, full_name, phone, verification_status, verification_badge_shown)
      values ($1, 'Standard Admin', '0000000000', 'verified', true)
      on conflict (user_id)
      do update set
        full_name = coalesce(profiles.full_name, excluded.full_name),
        phone = coalesce(profiles.phone, excluded.phone),
        verification_status = 'verified',
        verification_badge_shown = true,
        updated_at = now()
    `,
      [user.id],
    );

    await client.query("commit");
    app.log.info({ email }, "Default admin account is ready.");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
};

const start = async () => {
  try {
    await ensureDefaultAdmin();
    await app.listen({ port: env.PORT, host: env.HOST });
  } catch (error) {
    app.log.error(error);
    process.exit(1);
  }
};

start();

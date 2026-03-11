import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool";
import { hashPassword, verifyPassword } from "../../lib/password";

const signupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(["buyer", "seller"]),
  fullName: z.string().min(2),
  phone: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post("/auth/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Validation error",
        details: parsed.error.issues,
      });
    }
    const body = parsed.data;

    const existing = await pool.query("select id from users where email = $1", [body.email.toLowerCase()]);
    if (existing.rowCount) {
      throw fastify.httpErrors.conflict("Email already registered");
    }

    const passwordHash = await hashPassword(body.password);

    const client = await pool.connect();
    try {
      await client.query("begin");

      const userResult = await client.query(
        `
        insert into users (email, password_hash, auth_provider, role)
        values ($1, $2, 'email', $3)
        returning id, email, role, created_at
      `,
        [body.email.toLowerCase(), passwordHash, body.role],
      );

      const user = userResult.rows[0];

      await client.query(
        `
        insert into profiles (user_id, full_name, phone, verification_status, verification_badge_shown)
        values ($1, $2, $3, 'unverified', false)
      `,
        [user.id, body.fullName, body.phone],
      );

      await client.query("commit");

      const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
      return reply.code(201).send({ token, user });
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  });

  fastify.post("/auth/login", async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Validation error",
        details: parsed.error.issues,
      });
    }
    const body = parsed.data;

    const result = await pool.query(
      `
      select id, email, role, password_hash
      from users
      where email = $1
    `,
      [body.email.toLowerCase()],
    );

    const user = result.rows[0];
    if (!user || !user.password_hash) {
      throw fastify.httpErrors.unauthorized("Invalid credentials");
    }

    const isValid = await verifyPassword(body.password, user.password_hash);
    if (!isValid) {
      throw fastify.httpErrors.unauthorized("Invalid credentials");
    }

    const token = await reply.jwtSign({ sub: user.id, email: user.email, role: user.role });
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
      },
    };
  });

  fastify.post("/auth/oauth/google", async () => {
    throw fastify.httpErrors.notImplemented("Google OAuth is not wired in this build yet");
  });

  fastify.post("/auth/oauth/facebook", async () => {
    throw fastify.httpErrors.notImplemented("Facebook OAuth is not wired in this build yet");
  });

  fastify.post(
    "/auth/logout",
    {
      preHandler: [fastify.authenticate],
    },
    async () => {
      return { loggedOut: true };
    },
  );
};

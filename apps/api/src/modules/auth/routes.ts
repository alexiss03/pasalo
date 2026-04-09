import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { env } from "../../config/env";
import { pool } from "../../db/pool";
import { hashPassword, verifyPassword } from "../../lib/password";
import { createSupabaseAuthUser, deleteSupabaseAuthUser, signInSupabaseAuthUser } from "../../lib/supabaseAuth";

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
  const upsertProfile = async (
    runner: { query: (text: string, params?: unknown[]) => Promise<{ rows: Record<string, unknown>[] }> },
    payload: { userId: string; fullName: string; phone: string },
  ) => {
    await runner.query(
      `
      insert into profiles (user_id, full_name, phone, verification_status, verification_badge_shown)
      values ($1, $2, $3, 'unverified', false)
      on conflict (user_id)
      do update set
        full_name = coalesce(profiles.full_name, excluded.full_name),
        phone = coalesce(profiles.phone, excluded.phone),
        updated_at = now()
    `,
      [payload.userId, payload.fullName, payload.phone],
    );
  };

  const ensureSupabaseBackedUser = async (payload: {
    email: string;
    role: "buyer" | "seller" | "agent" | "attorney" | "admin";
    fullName: string;
    phone: string;
  }) => {
    const client = await pool.connect();
    try {
      await client.query("begin");

      await client.query(
        `
        insert into users (email, password_hash, auth_provider, role)
        values ($1, null, 'supabase', $2)
        on conflict (email)
        do update set
          auth_provider = 'supabase',
          updated_at = now()
        returning id, email, role
      `,
        [payload.email, payload.role],
      );
      const user = (await client.query(
        `
        select id, email, role
        from users
        where email = $1
      `,
        [payload.email],
      )).rows[0] as { id: string; email: string; role: string };

      await upsertProfile(client, {
        userId: user.id,
        fullName: payload.fullName,
        phone: payload.phone,
      });

      await client.query("commit");
      return user;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  };

  fastify.post("/auth/signup", async (request, reply) => {
    const parsed = signupSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({
        message: "Validation error",
        details: parsed.error.issues,
      });
    }
    const body = parsed.data;
    const normalizedEmail = body.email.toLowerCase();

    const existing = await pool.query("select id from users where email = $1", [normalizedEmail]);
    if (existing.rowCount) {
      throw fastify.httpErrors.conflict("Email already registered");
    }

    if (env.AUTH_PROVIDER === "supabase") {
      let createdAuthUserId: string | null = null;
      try {
        const supabaseUser = await createSupabaseAuthUser({
          email: normalizedEmail,
          password: body.password,
          role: body.role,
          fullName: body.fullName,
          phone: body.phone,
        });
        createdAuthUserId = supabaseUser.id;

        const user = await ensureSupabaseBackedUser({
          email: normalizedEmail,
          role: body.role,
          fullName: body.fullName,
          phone: body.phone,
        });

        const token = await reply.jwtSign({ sub: user.id, email: normalizedEmail, role: user.role });
        return reply.code(201).send({
          token,
          user: {
            id: user.id,
            email: normalizedEmail,
            role: user.role,
          },
        });
      } catch (error) {
        if (createdAuthUserId) {
          try {
            await deleteSupabaseAuthUser(createdAuthUserId);
          } catch {
            // Best-effort cleanup only.
          }
        }
        throw error;
      }
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
        [normalizedEmail, passwordHash, body.role],
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
    const normalizedEmail = body.email.toLowerCase();

    if (env.AUTH_PROVIDER === "supabase") {
      const supabaseUser = await signInSupabaseAuthUser(normalizedEmail, body.password);
      const metadata = supabaseUser.user_metadata ?? {};
      const roleMetadata =
        (typeof supabaseUser.app_metadata?.role === "string" && supabaseUser.app_metadata.role) ||
        (typeof metadata.app_role === "string" && metadata.app_role) ||
        "buyer";
      const role =
        roleMetadata === "seller" ||
        roleMetadata === "agent" ||
        roleMetadata === "attorney" ||
        roleMetadata === "admin"
          ? roleMetadata
          : "buyer";

      const user = await ensureSupabaseBackedUser({
        email: normalizedEmail,
        role,
        fullName: typeof metadata.full_name === "string" ? metadata.full_name : "",
        phone: typeof metadata.phone === "string" ? metadata.phone : "",
      });

      const token = await reply.jwtSign({ sub: user.id, email: normalizedEmail, role: user.role });
      return {
        token,
        user: {
          id: user.id,
          email: normalizedEmail,
          role: user.role,
        },
      };
    }

    const result = await pool.query(
      `
      select id, email, role, password_hash
      from users
      where email = $1
    `,
      [normalizedEmail],
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

import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  city: z.string().min(2).optional(),
});

const verificationDocSchema = z.object({
  listingId: z.string().uuid(),
  docType: z.enum(["reservation_agreement", "soa", "id", "government_clearance_optional"]),
  fileKey: z.string().min(3),
});

const roleApplicationSchema = z.object({
  requestedRole: z.enum(["buyer", "seller", "agent"]),
  reason: z.string().min(10).max(1200),
});

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get(
    "/me",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await pool.query(
        `
        select
          u.id,
          u.email,
          u.role,
          p.full_name,
          p.phone,
          p.city,
          p.verification_status,
          p.verification_badge_shown
        from users u
        left join profiles p on p.user_id = u.id
        where u.id = $1
      `,
        [request.user.sub],
      );

      const me = result.rows[0];
      if (!me) {
        throw fastify.httpErrors.notFound("User not found");
      }

      return me;
    },
  );

  fastify.patch(
    "/me/profile",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const body = updateProfileSchema.parse(request.body);
      const fields: string[] = [];
      const values: string[] = [];
      let index = 1;

      if (body.fullName !== undefined) {
        fields.push(`full_name = $${index++}`);
        values.push(body.fullName);
      }

      if (body.phone !== undefined) {
        fields.push(`phone = $${index++}`);
        values.push(body.phone);
      }

      if (body.city !== undefined) {
        fields.push(`city = $${index++}`);
        values.push(body.city);
      }

      if (!fields.length) {
        throw fastify.httpErrors.badRequest("No profile fields provided");
      }

      values.push(request.user.sub);

      const result = await pool.query(
        `
        update profiles
        set ${fields.join(", ")}, updated_at = now()
        where user_id = $${index}
        returning user_id, full_name, phone, city, verification_status
      `,
        values,
      );

      if (!result.rowCount) {
        throw fastify.httpErrors.notFound("Profile not found");
      }

      return result.rows[0];
    },
  );

  fastify.post(
    "/me/verification-docs",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = verificationDocSchema.parse(request.body);

      const listingResult = await pool.query("select id, owner_user_id from listings where id = $1", [body.listingId]);
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      const isOwner = listing.owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("You can only upload docs for your own listing");
      }

      const inserted = await pool.query(
        `
        insert into listing_verifications (listing_id, user_id, doc_type, file_key, status)
        values ($1, $2, $3, $4, 'pending')
        returning id, listing_id, user_id, doc_type, status, created_at
      `,
        [body.listingId, request.user.sub, body.docType, body.fileKey],
      );

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.post(
    "/me/role-applications",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = roleApplicationSchema.parse(request.body);

      const userResult = await pool.query("select id, role from users where id = $1", [request.user.sub]);
      if (!userResult.rowCount) {
        throw fastify.httpErrors.notFound("User not found");
      }

      const user = userResult.rows[0];
      if (body.requestedRole === user.role) {
        throw fastify.httpErrors.badRequest("Requested role must be different from your current role");
      }

      const existingPending = await pool.query(
        `
        select id
        from role_applications
        where user_id = $1 and requested_role = $2 and status = 'pending'
      `,
        [request.user.sub, body.requestedRole],
      );

      if (existingPending.rowCount) {
        throw fastify.httpErrors.conflict("You already have a pending application for this role");
      }

      const inserted = await pool.query(
        `
        insert into role_applications (user_id, from_role, requested_role, reason, status)
        values ($1, $2, $3, $4, 'pending')
        returning id, user_id, from_role, requested_role, reason, status, created_at
      `,
        [request.user.sub, user.role, body.requestedRole, body.reason],
      );

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.get(
    "/me/role-applications",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await pool.query(
        `
        select
          id,
          user_id,
          from_role,
          requested_role,
          reason,
          status,
          rejection_reason,
          created_at,
          updated_at,
          reviewed_at
        from role_applications
        where user_id = $1
        order by created_at desc
      `,
        [request.user.sub],
      );

      return { items: result.rows };
    },
  );
};

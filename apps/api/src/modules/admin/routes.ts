import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool";

const listingReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().min(5).optional(),
});

const verificationReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().min(5).optional(),
});

const roleApplicationReviewSchema = z.object({
  action: z.enum(["approve", "reject"]),
  rejectionReason: z.string().min(5).optional(),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const requireAdmin = async (request: any) => {
    await fastify.authenticate(request);
    fastify.authorizeRoles(request, ["admin"]);
  };

  fastify.get(
    "/admin/listings/pending",
    {
      preHandler: [requireAdmin],
    },
    async () => {
      const result = await pool.query(
        `
        select
          l.id,
          l.title,
          l.project_name,
          l.location_city,
          l.location_province,
          l.created_at,
          p.full_name as seller_name,
          p.verification_status
        from listings l
        join profiles p on p.user_id = l.owner_user_id
        where l.status = 'pending_review'
        order by l.created_at asc
      `,
      );

      return { items: result.rows };
    },
  );

  fastify.patch(
    "/admin/listings/:id/review",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = listingReviewSchema.parse(request.body);

      if (body.action === "reject" && !body.rejectionReason) {
        throw fastify.httpErrors.badRequest("rejectionReason is required when rejecting a listing");
      }

      const nextStatus = body.action === "approve" ? "live" : "rejected";

      const result = await pool.query(
        `
        update listings
        set status = $1, updated_at = now()
        where id = $2
        returning id, status
      `,
        [nextStatus, params.id],
      );

      if (!result.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      await pool.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by)
        values ($1, 'pending_review', $2, $3)
      `,
        [params.id, nextStatus, request.user.sub],
      );

      if (body.action === "reject") {
        await pool.query(
          `
          insert into audit_logs (actor_user_id, action, target_type, target_id, context)
          values ($1, 'listing_rejected', 'listing', $2, $3::jsonb)
        `,
          [request.user.sub, params.id, JSON.stringify({ rejectionReason: body.rejectionReason })],
        );
      }

      return result.rows[0];
    },
  );

  fastify.get(
    "/admin/verifications",
    {
      preHandler: [requireAdmin],
    },
    async () => {
      const result = await pool.query(
        `
        select
          lv.id,
          lv.listing_id,
          lv.user_id,
          lv.doc_type,
          lv.file_key,
          lv.status,
          lv.created_at
        from listing_verifications lv
        where lv.status = 'pending'
        order by lv.created_at asc
      `,
      );

      return { items: result.rows };
    },
  );

  fastify.patch(
    "/admin/verifications/:id",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = verificationReviewSchema.parse(request.body);

      if (body.action === "reject" && !body.rejectionReason) {
        throw fastify.httpErrors.badRequest("rejectionReason is required when rejecting a document");
      }

      const nextStatus = body.action === "approve" ? "approved" : "rejected";

      const result = await pool.query(
        `
        update listing_verifications
        set status = $1, reviewed_by = $2, reviewed_at = now(), rejection_reason = $3
        where id = $4
        returning id, status
      `,
        [nextStatus, request.user.sub, body.rejectionReason ?? null, params.id],
      );

      if (!result.rowCount) {
        throw fastify.httpErrors.notFound("Verification item not found");
      }

      return result.rows[0];
    },
  );

  fastify.get(
    "/admin/deals/dashboard",
    {
      preHandler: [requireAdmin],
    },
    async () => {
      const totals = await pool.query(
        `
        select
          count(*)::int as total_deals,
          count(*) filter (where current_stage = 'inquiry')::int as inquiry,
          count(*) filter (where current_stage = 'qualified')::int as qualified,
          count(*) filter (where current_stage = 'offer')::int as offer,
          count(*) filter (where current_stage = 'developer_review')::int as developer_review,
          count(*) filter (where current_stage = 'closed_won')::int as closed_won,
          count(*) filter (where current_stage = 'closed_lost')::int as closed_lost
        from deal_pipelines
      `,
      );

      return totals.rows[0];
    },
  );

  fastify.get(
    "/admin/role-applications",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = z
        .object({
          status: z.enum(["pending", "approved", "rejected"]).optional(),
        })
        .parse(request.query);

      const values: string[] = [];
      const where = query.status ? "where ra.status = $1" : "";
      if (query.status) {
        values.push(query.status);
      }

      const result = await pool.query(
        `
        select
          ra.id,
          ra.user_id,
          u.email,
          ra.from_role,
          ra.requested_role,
          ra.reason,
          ra.status,
          ra.rejection_reason,
          ra.created_at,
          ra.reviewed_at
        from role_applications ra
        join users u on u.id = ra.user_id
        ${where}
        order by
          case when ra.status = 'pending' then 0 else 1 end,
          ra.created_at asc
      `,
        values,
      );

      return { items: result.rows };
    },
  );

  fastify.patch(
    "/admin/role-applications/:id",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = roleApplicationReviewSchema.parse(request.body);

      if (body.action === "reject" && !body.rejectionReason) {
        throw fastify.httpErrors.badRequest("rejectionReason is required when rejecting a role application");
      }

      const applicationResult = await pool.query(
        `
        select id, user_id, from_role, requested_role, status
        from role_applications
        where id = $1
      `,
        [params.id],
      );

      if (!applicationResult.rowCount) {
        throw fastify.httpErrors.notFound("Role application not found");
      }

      const application = applicationResult.rows[0];
      if (application.status !== "pending") {
        throw fastify.httpErrors.badRequest("Role application is already reviewed");
      }

      const nextStatus = body.action === "approve" ? "approved" : "rejected";

      const client = await pool.connect();
      try {
        await client.query("begin");

        const updated = await client.query(
          `
          update role_applications
          set
            status = $1,
            rejection_reason = $2,
            reviewed_by = $3,
            reviewed_at = now(),
            updated_at = now()
          where id = $4
          returning id, user_id, from_role, requested_role, status, rejection_reason, reviewed_at
        `,
          [nextStatus, body.rejectionReason ?? null, request.user.sub, params.id],
        );

        if (body.action === "approve") {
          await client.query(
            `
            update users
            set role = $1, updated_at = now()
            where id = $2
          `,
            [application.requested_role, application.user_id],
          );
        }

        await client.query(
          `
          insert into audit_logs (actor_user_id, action, target_type, target_id, context)
          values ($1, $2, 'role_application', $3, $4::jsonb)
        `,
          [
            request.user.sub,
            body.action === "approve" ? "role_application_approved" : "role_application_rejected",
            params.id,
            JSON.stringify({
              userId: application.user_id,
              fromRole: application.from_role,
              toRole: application.requested_role,
              rejectionReason: body.rejectionReason ?? null,
            }),
          ],
        );

        await client.query("commit");
        return updated.rows[0];
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  );
};

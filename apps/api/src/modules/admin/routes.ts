import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { pool } from "../../db/pool";

const listingStatuses = ["draft", "pending_review", "live", "paused", "expired", "rejected", "archived"] as const;
const transactionStatuses = ["available", "auctioned", "in_deal", "buying_in_progress", "bought", "released"] as const;
const transferStatuses = [
  "not_started",
  "document_review",
  "developer_approval",
  "contract_signing",
  "transfer_in_process",
  "transfer_completed",
  "transfer_blocked",
] as const;
const documentAssistanceStatuses = [
  "not_requested",
  "requested",
  "in_review",
  "collecting_documents",
  "processing",
  "completed",
  "declined",
] as const;
const roleStatuses = ["pending", "approved", "rejected"] as const;
const userRoles = ["buyer", "seller", "agent", "attorney", "admin"] as const;
const paymentStatuses = ["pending", "paid", "canceled"] as const;

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

const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

const usersQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  role: z.enum(userRoles).optional(),
});

const listingsQuerySchema = paginationSchema.extend({
  q: z.string().optional(),
  status: z.enum(listingStatuses).optional(),
  transactionStatus: z.enum(transactionStatuses).optional(),
  transferStatus: z.enum(transferStatuses).optional(),
  documentAssistanceStatus: z.enum(documentAssistanceStatuses).optional(),
  city: z.string().optional(),
  province: z.string().optional(),
});

const leadsQuerySchema = paginationSchema.extend({
  listingId: z.string().uuid().optional(),
  q: z.string().optional(),
});

const conversationsQuerySchema = paginationSchema.extend({
  listingId: z.string().uuid().optional(),
});

const paymentIntentsQuerySchema = paginationSchema.extend({
  status: z.enum(paymentStatuses).optional(),
});

const auditLogQuerySchema = paginationSchema.extend({
  action: z.string().optional(),
  targetType: z.string().optional(),
});

const updateUserRoleSchema = z.object({
  role: z.enum(userRoles),
});

const updateListingAdminSchema = z.object({
  status: z.enum(listingStatuses).optional(),
  isFeatured: z.boolean().optional(),
  readinessScore: z.number().int().min(0).max(100).optional(),
  transactionStatus: z.enum(transactionStatuses).optional(),
  transferStatus: z.enum(transferStatuses).optional(),
  activeBuyerUserId: z.string().uuid().nullable().optional(),
  documentAssistanceRequested: z.boolean().optional(),
  documentAssistanceStatus: z.enum(documentAssistanceStatuses).optional(),
  documentAssistanceNotes: z.string().max(2000).nullable().optional(),
  commissionRatePct: z.number().min(3).max(5).optional(),
  leadValidityMonths: z.number().int().min(6).max(12).optional(),
  paymentDueDays: z.number().int().min(1).max(30).optional(),
});

const roleApplicationListQuerySchema = z.object({
  status: z.enum(roleStatuses).optional(),
});
const developerListQuerySchema = z.object({
  includeInactive: z.coerce.boolean().default(true),
});
const createDeveloperSchema = z.object({
  name: z.string().min(2).max(160),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});
const updateDeveloperSchema = z.object({
  name: z.string().min(2).max(160).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

const toPageMeta = (page: number, pageSize: number, total: number) => ({
  page,
  pageSize,
  total,
  totalPages: total === 0 ? 0 : Math.ceil(total / pageSize),
});

export const adminRoutes: FastifyPluginAsync = async (fastify) => {
  const requireAdmin = async (request: any) => {
    await fastify.authenticate(request);
    fastify.authorizeRoles(request, ["admin"]);
  };

  fastify.get(
    "/admin/developers",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = developerListQuerySchema.parse(request.query);
      const whereSql = query.includeInactive ? "" : "where is_active = true";

      const result = await pool.query(
        `
        select
          id,
          name,
          is_active,
          sort_order,
          created_at,
          updated_at
        from developers
        ${whereSql}
        order by sort_order asc, name asc
      `,
      );

      return { items: result.rows };
    },
  );

  fastify.post(
    "/admin/developers",
    {
      preHandler: [requireAdmin],
    },
    async (request, reply) => {
      const body = createDeveloperSchema.parse(request.body);
      const normalizedName = body.name.trim();

      const duplicate = await pool.query(
        `
        select id
        from developers
        where lower(name) = lower($1)
        limit 1
      `,
        [normalizedName],
      );
      if (duplicate.rowCount) {
        throw fastify.httpErrors.conflict("Developer already exists.");
      }

      const inserted = await pool.query(
        `
        insert into developers (name, is_active, sort_order)
        values ($1, $2, $3)
        returning id, name, is_active, sort_order, created_at, updated_at
      `,
        [normalizedName, body.isActive ?? true, body.sortOrder ?? 0],
      );

      await pool.query(
        `
        insert into audit_logs (actor_user_id, action, target_type, target_id, context)
        values ($1, 'admin_developer_created', 'developer', $2, $3::jsonb)
      `,
        [request.user.sub, inserted.rows[0].id, JSON.stringify({ name: normalizedName })],
      );

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.patch(
    "/admin/developers/:id",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateDeveloperSchema.parse(request.body);

      if (body.name === undefined && body.isActive === undefined && body.sortOrder === undefined) {
        throw fastify.httpErrors.badRequest("No developer fields provided.");
      }

      if (body.name !== undefined) {
        const duplicate = await pool.query(
          `
          select id
          from developers
          where lower(name) = lower($1)
            and id <> $2
          limit 1
        `,
          [body.name.trim(), params.id],
        );
        if (duplicate.rowCount) {
          throw fastify.httpErrors.conflict("Developer name already exists.");
        }
      }

      const fields: string[] = [];
      const values: Array<string | number | boolean> = [];
      let index = 1;

      if (body.name !== undefined) {
        fields.push(`name = $${index++}`);
        values.push(body.name.trim());
      }
      if (body.isActive !== undefined) {
        fields.push(`is_active = $${index++}`);
        values.push(body.isActive);
      }
      if (body.sortOrder !== undefined) {
        fields.push(`sort_order = $${index++}`);
        values.push(body.sortOrder);
      }

      values.push(params.id);

      const updated = await pool.query(
        `
        update developers
        set ${fields.join(", ")}, updated_at = now()
        where id = $${index}
        returning id, name, is_active, sort_order, created_at, updated_at
      `,
        values,
      );

      if (!updated.rowCount) {
        throw fastify.httpErrors.notFound("Developer not found");
      }

      await pool.query(
        `
        insert into audit_logs (actor_user_id, action, target_type, target_id, context)
        values ($1, 'admin_developer_updated', 'developer', $2, $3::jsonb)
      `,
        [request.user.sub, params.id, JSON.stringify(body)],
      );

      return updated.rows[0];
    },
  );

  fastify.get(
    "/admin/dashboard",
    {
      preHandler: [requireAdmin],
    },
    async () => {
      const summaryResult = await pool.query(
        `
        select
          (select count(*)::int from listings) as total_listings,
          (select count(*)::int from listings where status = 'live') as live_listings,
          (select count(*)::int from listings where status = 'pending_review') as pending_listings,
          (select count(*)::int from users) as total_users,
          (select count(*)::int from users where role = 'buyer') as buyer_users,
          (select count(*)::int from users where role = 'seller') as seller_users,
          (select count(*)::int from users where role = 'agent') as agent_users,
          (select count(*)::int from users where role = 'attorney') as attorney_users,
          (select count(*)::int from users where role = 'admin') as admin_users,
          (select coalesce(avg(cash_out_price_php), 0)::numeric(14,2) from listing_financials) as average_cash_out_price_php,
          (select count(*)::int from listing_verifications where status = 'pending') as pending_verifications,
          (select count(*)::int from listings where document_assistance_status in ('requested', 'in_review', 'collecting_documents', 'processing')) as pending_document_assistance,
          (select count(*)::int from role_applications where status = 'pending') as pending_role_applications,
          (select count(*)::int from conversations) as total_conversations,
          (select count(*)::int from payment_intents where status = 'pending') as pending_payment_intents,
          (select count(*)::int from audit_logs) as total_audit_logs
      `,
      );

      const locationsResult = await pool.query(
        `
        select
          location_province,
          location_city,
          count(*)::int as listing_count
        from listings
        group by location_province, location_city
        order by listing_count desc, location_province asc, location_city asc
        limit 8
      `,
      );

      const dealSummaryResult = await pool.query(
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

      return {
        summary: summaryResult.rows[0],
        topLocations: locationsResult.rows,
        deals: dealSummaryResult.rows[0],
      };
    },
  );

  fastify.get(
    "/admin/users",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = usersQuerySchema.parse(request.query);
      const whereClauses: string[] = [];
      const values: Array<string | number> = [];

      if (query.q?.trim()) {
        values.push(`%${query.q.trim().toLowerCase()}%`);
        whereClauses.push(
          `(lower(u.email) like $${values.length} or lower(coalesce(p.full_name, '')) like $${values.length})`,
        );
      }

      if (query.role) {
        values.push(query.role);
        whereClauses.push(`u.role = $${values.length}`);
      }

      const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";
      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(
        `select count(*)::int as total from users u left join profiles p on p.user_id = u.id ${whereSql}`,
        values,
      );

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          u.id,
          u.email,
          u.role,
          u.created_at,
          p.full_name,
          p.phone,
          p.city,
          p.verification_status,
          coalesce(listing_counts.count, 0)::int as listing_count
        from users u
        left join profiles p on p.user_id = u.id
        left join lateral (
          select count(*)::int as count
          from listings l
          where l.owner_user_id = u.id
        ) listing_counts on true
        ${whereSql}
        order by u.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );

  fastify.patch(
    "/admin/users/:id/role",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateUserRoleSchema.parse(request.body);

      const result = await pool.query(
        `
        update users
        set role = $1, updated_at = now()
        where id = $2
        returning id, email, role, updated_at
      `,
        [body.role, params.id],
      );

      if (!result.rowCount) {
        throw fastify.httpErrors.notFound("User not found");
      }

      await pool.query(
        `
        insert into audit_logs (actor_user_id, action, target_type, target_id, context)
        values ($1, 'admin_user_role_updated', 'user', $2, $3::jsonb)
      `,
        [request.user.sub, params.id, JSON.stringify({ role: body.role })],
      );

      return result.rows[0];
    },
  );

  fastify.get(
    "/admin/listings",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = listingsQuerySchema.parse(request.query);
      const whereClauses: string[] = [];
      const values: Array<string | number> = [];

      if (query.q?.trim()) {
        values.push(`%${query.q.trim().toLowerCase()}%`);
        whereClauses.push(
          `
          (
            lower(l.title) like $${values.length}
            or lower(l.project_name) like $${values.length}
            or lower(l.developer_name) like $${values.length}
            or lower(u.email) like $${values.length}
          )
        `,
        );
      }

      if (query.status) {
        values.push(query.status);
        whereClauses.push(`l.status = $${values.length}`);
      }

      if (query.transactionStatus) {
        values.push(query.transactionStatus);
        whereClauses.push(`l.transaction_status = $${values.length}`);
      }

      if (query.transferStatus) {
        values.push(query.transferStatus);
        whereClauses.push(`l.transfer_status = $${values.length}`);
      }
      if (query.documentAssistanceStatus) {
        values.push(query.documentAssistanceStatus);
        whereClauses.push(`l.document_assistance_status = $${values.length}`);
      }

      if (query.city?.trim()) {
        values.push(query.city.trim().toLowerCase());
        whereClauses.push(`lower(l.location_city) = $${values.length}`);
      }

      if (query.province?.trim()) {
        values.push(query.province.trim().toLowerCase());
        whereClauses.push(`lower(l.location_province) = $${values.length}`);
      }

      const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";
      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(
        `select count(*)::int as total from listings l left join users u on u.id = l.owner_user_id ${whereSql}`,
        values,
      );

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          l.id,
          l.title,
          l.status,
          l.transaction_status,
          l.transfer_status,
          l.document_assistance_requested,
          l.document_assistance_status,
          l.document_assistance_notes,
          l.is_featured,
          l.readiness_score,
          l.location_city,
          l.location_province,
          l.created_at,
          l.updated_at,
          l.owner_user_id,
          u.email as owner_email,
          p.full_name as owner_name,
          lf.cash_out_price_php,
          lf.monthly_amortization_php,
          lsa.commission_rate_pct,
          lsa.lead_validity_months,
          lsa.payment_due_days
        from listings l
        left join users u on u.id = l.owner_user_id
        left join profiles p on p.user_id = l.owner_user_id
        left join listing_financials lf on lf.listing_id = l.id
        left join listing_seller_agreements lsa on lsa.listing_id = l.id
        ${whereSql}
        order by l.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );

  fastify.patch(
    "/admin/listings/:id",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = updateListingAdminSchema.parse(request.body);
      const normalizedDocumentAssistanceRequested =
        body.documentAssistanceRequested ??
        (body.documentAssistanceStatus !== undefined
          ? body.documentAssistanceStatus !== "not_requested"
          : undefined);
      const normalizedDocumentAssistanceStatus =
        body.documentAssistanceStatus ??
        (normalizedDocumentAssistanceRequested === false ? "not_requested" : undefined);
      const hasAgreementUpdate =
        body.commissionRatePct !== undefined ||
        body.leadValidityMonths !== undefined ||
        body.paymentDueDays !== undefined;

      if (
        body.status === undefined &&
        body.isFeatured === undefined &&
        body.readinessScore === undefined &&
        body.transactionStatus === undefined &&
        body.transferStatus === undefined &&
        body.activeBuyerUserId === undefined &&
        normalizedDocumentAssistanceRequested === undefined &&
        normalizedDocumentAssistanceStatus === undefined &&
        body.documentAssistanceNotes === undefined &&
        !hasAgreementUpdate
      ) {
        throw fastify.httpErrors.badRequest("No admin listing fields provided");
      }

      if (
        normalizedDocumentAssistanceRequested === false &&
        normalizedDocumentAssistanceStatus !== undefined &&
        normalizedDocumentAssistanceStatus !== "not_requested"
      ) {
        throw fastify.httpErrors.badRequest(
          "documentAssistanceStatus must be not_requested when documentAssistanceRequested is false",
        );
      }

      const fields: string[] = [];
      const values: Array<string | number | boolean | null> = [];
      let index = 1;

      if (body.status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(body.status);
      }

      if (body.isFeatured !== undefined) {
        fields.push(`is_featured = $${index++}`);
        values.push(body.isFeatured);
      }

      if (body.readinessScore !== undefined) {
        fields.push(`readiness_score = $${index++}`);
        values.push(body.readinessScore);
      }

      if (body.transactionStatus !== undefined) {
        fields.push(`transaction_status = $${index++}`);
        values.push(body.transactionStatus);
      }

      if (body.transferStatus !== undefined) {
        fields.push(`transfer_status = $${index++}`);
        values.push(body.transferStatus);
      }

      if (body.activeBuyerUserId !== undefined) {
        fields.push(`active_buyer_user_id = $${index++}`);
        values.push(body.activeBuyerUserId);
      }

      if (normalizedDocumentAssistanceRequested !== undefined) {
        fields.push(`document_assistance_requested = $${index++}`);
        values.push(normalizedDocumentAssistanceRequested);
      }

      if (normalizedDocumentAssistanceStatus !== undefined) {
        fields.push(`document_assistance_status = $${index++}`);
        values.push(normalizedDocumentAssistanceStatus);
      }

      if (body.documentAssistanceNotes !== undefined) {
        fields.push(`document_assistance_notes = $${index++}`);
        values.push(body.documentAssistanceNotes);
      }

      if (
        normalizedDocumentAssistanceRequested !== undefined ||
        normalizedDocumentAssistanceStatus !== undefined ||
        body.documentAssistanceNotes !== undefined
      ) {
        fields.push(`document_assistance_updated_at = now()`);
      }

      fields.push(`updated_at = now()`);
      values.push(params.id);

      const client = await pool.connect();
      try {
        await client.query("begin");
        const result = await client.query(
          `
          update listings
          set ${fields.join(", ")}
          where id = $${values.length}
          returning
            id,
            status,
            transaction_status,
            transfer_status,
            document_assistance_requested,
            document_assistance_status,
            document_assistance_notes,
            document_assistance_updated_at,
            is_featured,
            readiness_score,
            active_buyer_user_id,
            updated_at
        `,
          values,
        );

        if (!result.rowCount) {
          throw fastify.httpErrors.notFound("Listing not found");
        }

        let sellerAgreementContext: {
          commissionRatePct: number;
          leadValidityMonths: number;
          paymentDueDays: number;
        } | null = null;

        if (hasAgreementUpdate) {
          const agreementResult = await client.query(
            `
            select
              commission_rate_pct,
              lead_validity_months,
              payment_due_days
            from listing_seller_agreements
            where listing_id = $1
            limit 1
          `,
            [params.id],
          );

          if (!agreementResult.rowCount) {
            throw fastify.httpErrors.badRequest("Seller listing agreement not found for this listing.");
          }

          const currentAgreement = agreementResult.rows[0];
          const nextCommissionRatePct = body.commissionRatePct ?? Number(currentAgreement.commission_rate_pct);
          const nextLeadValidityMonths = body.leadValidityMonths ?? Number(currentAgreement.lead_validity_months);
          const nextPaymentDueDays = body.paymentDueDays ?? Number(currentAgreement.payment_due_days);
          const nextCommissionClause = `The seller agrees that any buyer introduced through this platform shall be considered a platform lead. If the property is sold to such buyer within ${nextLeadValidityMonths} months from introduction, the seller agrees to pay a commission of ${nextCommissionRatePct}% of the final selling price.`;
          const nextPaymentClause = `If the seller enters into a sale, contract to sell, or any transfer agreement with a buyer introduced through the platform, the seller shall pay the agreed commission within ${nextPaymentDueDays} days of the transaction.`;

          const updateAgreementResult = await client.query(
            `
            update listing_seller_agreements
            set
              commission_rate_pct = $1,
              lead_validity_months = $2,
              payment_due_days = $3,
              commission_clause = $4,
              payment_clause = $5
            where listing_id = $6
            returning commission_rate_pct, lead_validity_months, payment_due_days
          `,
            [
              nextCommissionRatePct,
              nextLeadValidityMonths,
              nextPaymentDueDays,
              nextCommissionClause,
              nextPaymentClause,
              params.id,
            ],
          );

          sellerAgreementContext = {
            commissionRatePct: Number(updateAgreementResult.rows[0].commission_rate_pct),
            leadValidityMonths: Number(updateAgreementResult.rows[0].lead_validity_months),
            paymentDueDays: Number(updateAgreementResult.rows[0].payment_due_days),
          };
        }

        await client.query(
          `
          insert into audit_logs (actor_user_id, action, target_type, target_id, context)
          values ($1, 'admin_listing_updated', 'listing', $2, $3::jsonb)
        `,
          [
            request.user.sub,
            params.id,
            JSON.stringify({
              ...body,
              ...(sellerAgreementContext ? { sellerAgreement: sellerAgreementContext } : {}),
            }),
          ],
        );

        await client.query("commit");
        return result.rows[0];
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  );

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
          lv.ai_auth_status,
          lv.ai_confidence,
          lv.ai_flags,
          lv.ai_checked_at,
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
    "/admin/role-applications",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = roleApplicationListQuerySchema.parse(request.query);

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

  fastify.get(
    "/admin/leads",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = leadsQuerySchema.parse(request.query);
      const whereClauses: string[] = [];
      const values: Array<string | number> = [];

      if (query.listingId) {
        values.push(query.listingId);
        whereClauses.push(`pl.listing_id = $${values.length}`);
      }

      if (query.q?.trim()) {
        values.push(`%${query.q.trim().toLowerCase()}%`);
        whereClauses.push(
          `
          (
            lower(coalesce(pl.buyer_name, '')) like $${values.length}
            or lower(pl.buyer_email) like $${values.length}
            or lower(l.title) like $${values.length}
          )
        `,
        );
      }

      const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";
      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(
        `select count(*)::int as total from platform_leads pl join listings l on l.id = pl.listing_id ${whereSql}`,
        values,
      );

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          pl.id,
          pl.listing_id,
          pl.buyer_user_id,
          pl.buyer_name,
          pl.buyer_phone,
          pl.buyer_email,
          pl.source,
          pl.first_inquiry_at,
          pl.last_activity_at,
          l.title as listing_title,
          l.location_city,
          l.location_province
        from platform_leads pl
        join listings l on l.id = pl.listing_id
        ${whereSql}
        order by pl.first_inquiry_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );

  fastify.get(
    "/admin/conversations",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = conversationsQuerySchema.parse(request.query);
      const values: Array<string | number> = [];
      const whereSql = query.listingId ? "where c.listing_id = $1" : "";
      if (query.listingId) {
        values.push(query.listingId);
      }

      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(
        `select count(*)::int as total from conversations c ${whereSql}`,
        values,
      );

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          c.id,
          c.listing_id,
          c.buyer_user_id,
          c.seller_user_id,
          c.created_at,
          l.title as listing_title,
          buyer.email as buyer_email,
          seller.email as seller_email,
          pb.full_name as buyer_name,
          ps.full_name as seller_name,
          lm.body as last_message_body,
          lm.created_at as last_message_at,
          coalesce(mc.message_count, 0)::int as message_count,
          coalesce(pp.pending_payment_count, 0)::int as pending_payment_count
        from conversations c
        join listings l on l.id = c.listing_id
        left join users buyer on buyer.id = c.buyer_user_id
        left join users seller on seller.id = c.seller_user_id
        left join profiles pb on pb.user_id = c.buyer_user_id
        left join profiles ps on ps.user_id = c.seller_user_id
        left join lateral (
          select m.body, m.created_at
          from messages m
          where m.conversation_id = c.id
          order by m.created_at desc
          limit 1
        ) lm on true
        left join lateral (
          select count(*)::int as message_count
          from messages m2
          where m2.conversation_id = c.id
        ) mc on true
        left join lateral (
          select count(*)::int as pending_payment_count
          from payment_intents pi
          where pi.conversation_id = c.id and pi.status = 'pending'
        ) pp on true
        ${whereSql}
        order by coalesce(lm.created_at, c.created_at) desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );

  fastify.get(
    "/admin/payment-intents",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = paymentIntentsQuerySchema.parse(request.query);
      const values: Array<string | number> = [];
      const whereSql = query.status ? "where pi.status = $1" : "";
      if (query.status) {
        values.push(query.status);
      }

      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(
        `select count(*)::int as total from payment_intents pi ${whereSql}`,
        values,
      );

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          pi.id,
          pi.conversation_id,
          pi.listing_id,
          pi.requested_by_user_id,
          pi.payer_user_id,
          pi.payee_user_id,
          pi.amount_php,
          pi.note,
          pi.status,
          pi.paid_at,
          pi.canceled_at,
          pi.created_at,
          listing.title as listing_title,
          payer.email as payer_email,
          payee.email as payee_email
        from payment_intents pi
        join listings listing on listing.id = pi.listing_id
        left join users payer on payer.id = pi.payer_user_id
        left join users payee on payee.id = pi.payee_user_id
        ${whereSql}
        order by pi.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );

  fastify.get(
    "/admin/audit-logs",
    {
      preHandler: [requireAdmin],
    },
    async (request) => {
      const query = auditLogQuerySchema.parse(request.query);
      const whereClauses: string[] = [];
      const values: Array<string | number> = [];

      if (query.action?.trim()) {
        values.push(query.action.trim().toLowerCase());
        whereClauses.push(`lower(al.action) = $${values.length}`);
      }

      if (query.targetType?.trim()) {
        values.push(query.targetType.trim().toLowerCase());
        whereClauses.push(`lower(al.target_type) = $${values.length}`);
      }

      const whereSql = whereClauses.length ? `where ${whereClauses.join(" and ")}` : "";
      const offset = (query.page - 1) * query.pageSize;

      const countResult = await pool.query(`select count(*)::int as total from audit_logs al ${whereSql}`, values);

      values.push(query.pageSize, offset);
      const itemsResult = await pool.query(
        `
        select
          al.id,
          al.action,
          al.target_type,
          al.target_id,
          al.context,
          al.created_at,
          actor.email as actor_email
        from audit_logs al
        left join users actor on actor.id = al.actor_user_id
        ${whereSql}
        order by al.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      const total = Number(countResult.rows[0]?.total ?? 0);
      return { items: itemsResult.rows, page: toPageMeta(query.page, query.pageSize, total) };
    },
  );
};

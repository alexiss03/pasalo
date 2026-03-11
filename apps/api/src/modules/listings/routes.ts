import { FastifyPluginAsync } from "fastify";
import { computeListingFinancials, CreateListingRequest, validateListingFinancials } from "@pasalo/shared";
import { z } from "zod";
import { pool } from "../../db/pool";

const createListingSchema = z.object({
  propertyType: z.enum(["condo", "house_lot", "lot_only"]),
  projectName: z.string().min(2),
  developerName: z.string().min(2),
  locationCity: z.string().min(2),
  locationProvince: z.string().min(2),
  floorAreaSqm: z.number().positive(),
  unitNumber: z.string().optional().nullable(),
  turnoverDate: z.string().optional().nullable(),
  title: z.string().min(10),
  description: z.string().min(20),
  financials: z.object({
    originalPricePhp: z.number().nonnegative(),
    equityPaidPhp: z.number().nonnegative(),
    remainingBalancePhp: z.number().nonnegative(),
    monthlyAmortizationPhp: z.number().nonnegative(),
    cashOutPricePhp: z.number().nonnegative(),
  }),
}) satisfies z.ZodType<CreateListingRequest>;

const patchListingSchema = createListingSchema.partial();
const patchMarketStatusSchema = z.object({
  transactionStatus: z
    .enum(["available", "auctioned", "in_deal", "buying_in_progress", "bought", "released"])
    .optional(),
  transferStatus: z
    .enum([
      "not_started",
      "document_review",
      "developer_approval",
      "contract_signing",
      "transfer_in_process",
      "transfer_completed",
      "transfer_blocked",
    ])
    .optional(),
  activeBuyerUserId: z.string().uuid().nullable().optional(),
});
const listingMediaSchema = z.object({
  mediaType: z.enum(["image", "file"]),
  storageKey: z.string().min(3),
  isPrimary: z.boolean().optional(),
});

const listQuerySchema = z.object({
  city: z.string().optional(),
  province: z.string().optional(),
  type: z.enum(["condo", "house_lot", "lot_only"]).optional(),
  developer: z.string().optional(),
  cashOutMax: z.coerce.number().optional(),
  monthlyMax: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  verifiedOnly: z.coerce.boolean().optional(),
});

export const listingRoutes: FastifyPluginAsync = async (fastify) => {
  const openTransactionStatuses = new Set(["available", "released"]);
  const requiresActiveBuyerStatuses = new Set(["in_deal", "buying_in_progress", "bought"]);

  const isDbConnectionError = (error: unknown): boolean => {
    if (typeof error !== "object" || error === null) {
      return false;
    }

    const maybeCode = (error as { code?: string }).code;
    if (maybeCode === "ECONNREFUSED") {
      return true;
    }

    const maybeErrors = (error as { errors?: Array<{ code?: string }> }).errors;
    if (Array.isArray(maybeErrors) && maybeErrors.some((item) => item?.code === "ECONNREFUSED")) {
      return true;
    }

    return false;
  };

  fastify.post(
    "/listings",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      fastify.authorizeRoles(request, ["seller", "agent"]);

      const body = createListingSchema.parse(request.body);
      const financialErrors = validateListingFinancials(body.financials);
      if (financialErrors.length) {
        throw fastify.httpErrors.badRequest(financialErrors.join("; "));
      }

      const computed = computeListingFinancials(body.financials);

      const client = await pool.connect();
      try {
        await client.query("begin");
        const listingResult = await client.query(
          `
          insert into listings (
            owner_user_id,
            property_type,
            project_name,
            developer_name,
            location_city,
            location_province,
            floor_area_sqm,
            unit_number,
            turnover_date,
            title,
            description,
            status,
            last_confirmed_at,
            readiness_score
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',now(),30)
          returning *
        `,
          [
            request.user.sub,
            body.propertyType,
            body.projectName,
            body.developerName,
            body.locationCity,
            body.locationProvince,
            body.floorAreaSqm,
            body.unitNumber ?? null,
            body.turnoverDate ?? null,
            body.title,
            body.description,
          ],
        );

        const listing = listingResult.rows[0];

        await client.query(
          `
          insert into listing_financials (
            listing_id,
            original_price_php,
            equity_paid_php,
            remaining_balance_php,
            monthly_amortization_php,
            cash_out_price_php,
            est_total_cost_php
          )
          values ($1,$2,$3,$4,$5,$6,$7)
        `,
          [
            listing.id,
            body.financials.originalPricePhp,
            body.financials.equityPaidPhp,
            body.financials.remainingBalancePhp,
            body.financials.monthlyAmortizationPhp,
            body.financials.cashOutPricePhp,
            computed.estimatedTotalCostPhp,
          ],
        );

        await client.query(
          `
          insert into listing_status_events (listing_id, from_status, to_status, changed_by)
          values ($1, null, 'draft', $2)
        `,
          [listing.id, request.user.sub],
        );

        await client.query("commit");
        return reply.code(201).send({ listingId: listing.id });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  fastify.get("/listings", async (request) => {
    const query = listQuerySchema.parse(request.query);
    const whereClauses: string[] = ["l.status = 'live'"];
    const values: Array<string | number | boolean> = [];

    if (query.city) {
      values.push(query.city);
      whereClauses.push(`l.location_city = $${values.length}`);
    }
    if (query.province) {
      values.push(query.province);
      whereClauses.push(`l.location_province = $${values.length}`);
    }
    if (query.type) {
      values.push(query.type);
      whereClauses.push(`l.property_type = $${values.length}`);
    }
    if (query.developer) {
      values.push(query.developer);
      whereClauses.push(`l.developer_name = $${values.length}`);
    }
    if (query.cashOutMax !== undefined) {
      values.push(query.cashOutMax);
      whereClauses.push(`lf.cash_out_price_php <= $${values.length}`);
    }
    if (query.monthlyMax !== undefined) {
      values.push(query.monthlyMax);
      whereClauses.push(`lf.monthly_amortization_php <= $${values.length}`);
    }
    if (query.verifiedOnly) {
      whereClauses.push(`p.verification_status = 'verified'`);
    }

    values.push(query.pageSize);
    values.push((query.page - 1) * query.pageSize);

    try {
      const result = await pool.query(
        `
        select
          l.id,
          l.title,
          l.property_type,
          l.project_name,
          l.location_city,
          l.location_province,
          l.status,
          l.transaction_status,
          l.transfer_status,
          (l.transaction_status = any(array['available'::listing_transaction_status, 'released'::listing_transaction_status])) as is_open_for_new_buyers,
          l.last_confirmed_at,
          l.readiness_score,
          l.created_at,
          l.is_featured,
          lf.cash_out_price_php,
          lf.monthly_amortization_php,
          (p.verification_status = 'verified') as is_verified,
          lm.preview_image_url
        from listings l
        join listing_financials lf on lf.listing_id = l.id
        join profiles p on p.user_id = l.owner_user_id
        left join lateral (
          select storage_key as preview_image_url
          from listing_media
          where listing_id = l.id and media_type = 'image'
          order by is_primary desc, created_at asc
          limit 1
        ) lm on true
        where ${whereClauses.join(" and ")}
        order by
          (p.verification_status = 'verified') desc,
          l.is_featured desc,
          l.last_confirmed_at desc,
          l.created_at desc
        limit $${values.length - 1}
        offset $${values.length}
      `,
        values,
      );

      return {
        page: query.page,
        pageSize: query.pageSize,
        items: result.rows,
      };
    } catch (error) {
      if (isDbConnectionError(error)) {
        request.log.warn({ err: error }, "Database unavailable; returning empty listing feed");
        return {
          page: query.page,
          pageSize: query.pageSize,
          items: [],
          degraded: true,
        };
      }

      throw error;
    }
  });

  fastify.get("/listings/:id", async (request) => {
    const params = z.object({ id: z.string().uuid() }).parse(request.params);

    const result = await pool.query(
      `
      select
        l.*,
        lf.original_price_php,
        lf.equity_paid_php,
        lf.remaining_balance_php,
        lf.monthly_amortization_php,
        lf.cash_out_price_php,
        lf.est_total_cost_php,
        (l.transaction_status = any(array['available'::listing_transaction_status, 'released'::listing_transaction_status])) as is_open_for_new_buyers,
        p.full_name as seller_name,
        p.verification_status,
        p.verification_badge_shown
      from listings l
      join listing_financials lf on lf.listing_id = l.id
      join profiles p on p.user_id = l.owner_user_id
      where l.id = $1
    `,
      [params.id],
    );

    const listing = result.rows[0];
    if (!listing) {
      throw fastify.httpErrors.notFound("Listing not found");
    }

    const media = await pool.query(
      `
      select id, media_type, storage_key, is_primary, created_at
      from listing_media
      where listing_id = $1
      order by is_primary desc, created_at asc
    `,
      [params.id],
    );

    return {
      ...listing,
      media: media.rows,
    };
  });

  fastify.post(
    "/listings/:id/media",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = listingMediaSchema.parse(request.body);
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const ownerResult = await pool.query("select owner_user_id from listings where id = $1", [params.id]);
      if (!ownerResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const isOwner = ownerResult.rows[0].owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can upload media");
      }

      const client = await pool.connect();
      try {
        await client.query("begin");
        if (body.isPrimary) {
          await client.query("update listing_media set is_primary = false where listing_id = $1", [params.id]);
        }

        const inserted = await client.query(
          `
          insert into listing_media (listing_id, media_type, storage_key, is_primary)
          values ($1, $2, $3, $4)
          returning id, listing_id, media_type, storage_key, is_primary, created_at
        `,
          [params.id, body.mediaType, body.storageKey, Boolean(body.isPrimary)],
        );

        await client.query("commit");
        return reply.code(201).send(inserted.rows[0]);
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
    },
  );

  fastify.patch(
    "/listings/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchListingSchema.parse(request.body);

      const ownerCheck = await pool.query("select owner_user_id from listings where id = $1", [params.id]);
      if (!ownerCheck.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const isOwner = ownerCheck.rows[0].owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can edit this listing");
      }

      const fields: string[] = [];
      const values: Array<string | number | null> = [];
      let index = 1;

      const mapping: Record<string, string> = {
        propertyType: "property_type",
        projectName: "project_name",
        developerName: "developer_name",
        locationCity: "location_city",
        locationProvince: "location_province",
        floorAreaSqm: "floor_area_sqm",
        unitNumber: "unit_number",
        turnoverDate: "turnover_date",
        title: "title",
        description: "description",
      };

      for (const [apiField, dbField] of Object.entries(mapping)) {
        const value = body[apiField as keyof typeof body];
        if (value !== undefined) {
          fields.push(`${dbField} = $${index++}`);
          values.push((value as string | number | null) ?? null);
        }
      }

      if (fields.length) {
        values.push(params.id);
        await pool.query(
          `
          update listings
          set ${fields.join(", ")}, updated_at = now()
          where id = $${index}
        `,
          values,
        );
      }

      if (body.financials) {
        const financialErrors = validateListingFinancials(body.financials);
        if (financialErrors.length) {
          throw fastify.httpErrors.badRequest(financialErrors.join("; "));
        }

        const computed = computeListingFinancials(body.financials);
        await pool.query(
          `
          update listing_financials
          set
            original_price_php = $1,
            equity_paid_php = $2,
            remaining_balance_php = $3,
            monthly_amortization_php = $4,
            cash_out_price_php = $5,
            est_total_cost_php = $6,
            updated_at = now()
          where listing_id = $7
        `,
          [
            body.financials.originalPricePhp,
            body.financials.equityPaidPhp,
            body.financials.remainingBalancePhp,
            body.financials.monthlyAmortizationPhp,
            body.financials.cashOutPricePhp,
            computed.estimatedTotalCostPhp,
            params.id,
          ],
        );
      }

      return { updated: true };
    },
  );

  fastify.patch(
    "/listings/:id/market-status",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchMarketStatusSchema.parse(request.body);

      if (
        body.transactionStatus === undefined &&
        body.transferStatus === undefined &&
        body.activeBuyerUserId === undefined
      ) {
        throw fastify.httpErrors.badRequest("Provide at least one market-status field to update");
      }

      const listingResult = await pool.query(
        `
        select
          id,
          owner_user_id,
          transaction_status,
          transfer_status,
          active_buyer_user_id
        from listings
        where id = $1
      `,
        [params.id],
      );
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      const isOwner = listing.owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can update market status");
      }

      const nextTransactionStatus = body.transactionStatus ?? listing.transaction_status;
      const nextTransferStatus = body.transferStatus ?? listing.transfer_status;
      let nextActiveBuyerUserId =
        body.activeBuyerUserId === undefined ? listing.active_buyer_user_id : body.activeBuyerUserId;

      if (openTransactionStatuses.has(nextTransactionStatus) || nextTransactionStatus === "auctioned") {
        nextActiveBuyerUserId = null;
      }

      if (requiresActiveBuyerStatuses.has(nextTransactionStatus) && !nextActiveBuyerUserId) {
        throw fastify.httpErrors.badRequest(
          "activeBuyerUserId is required when transactionStatus is in_deal, buying_in_progress, or bought",
        );
      }

      const updatedResult = await pool.query(
        `
        update listings
        set
          transaction_status = $1,
          transfer_status = $2,
          active_buyer_user_id = $3,
          updated_at = now()
        where id = $4
        returning
          id,
          status,
          transaction_status,
          transfer_status,
          active_buyer_user_id
      `,
        [nextTransactionStatus, nextTransferStatus, nextActiveBuyerUserId, params.id],
      );

      await pool.query(
        `
        insert into audit_logs (actor_user_id, action, target_type, target_id, context)
        values ($1, 'listing_market_status_updated', 'listing', $2, $3::jsonb)
      `,
        [
          request.user.sub,
          params.id,
          JSON.stringify({
            from: {
              transactionStatus: listing.transaction_status,
              transferStatus: listing.transfer_status,
              activeBuyerUserId: listing.active_buyer_user_id,
            },
            to: {
              transactionStatus: nextTransactionStatus,
              transferStatus: nextTransferStatus,
              activeBuyerUserId: nextActiveBuyerUserId,
            },
          }),
        ],
      );

      return updatedResult.rows[0];
    },
  );

  fastify.post(
    "/listings/:id/publish",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const ownerResult = await pool.query("select owner_user_id from listings where id = $1", [params.id]);
      if (!ownerResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const isOwner = ownerResult.rows[0].owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can publish this listing");
      }

      await pool.query(
        `
        update listings
        set status = 'pending_review', updated_at = now()
        where id = $1
      `,
        [params.id],
      );

      await pool.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by)
        values ($1, 'draft', 'pending_review', $2)
      `,
        [params.id, request.user.sub],
      );

      return { status: "pending_review" };
    },
  );

  fastify.post(
    "/listings/:id/pause",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const ownerResult = await pool.query("select owner_user_id from listings where id = $1", [params.id]);
      if (!ownerResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const isOwner = ownerResult.rows[0].owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can pause this listing");
      }

      await pool.query(
        `
        update listings
        set status = 'paused', updated_at = now()
        where id = $1
      `,
        [params.id],
      );

      await pool.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by)
        values ($1, 'live', 'paused', $2)
      `,
        [params.id, request.user.sub],
      );

      return { status: "paused" };
    },
  );

  fastify.post(
    "/listings/:id/reconfirm",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const ownerResult = await pool.query("select owner_user_id from listings where id = $1", [params.id]);
      if (!ownerResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const isOwner = ownerResult.rows[0].owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can reconfirm this listing");
      }

      await pool.query(
        `
        update listings
        set last_confirmed_at = now(), updated_at = now(), status = case when status = 'expired' then 'paused' else status end
        where id = $1
      `,
        [params.id],
      );

      return { reconfirmed: true };
    },
  );
};

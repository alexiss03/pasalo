import { FastifyPluginAsync } from "fastify";
import { computeListingFinancials, CreateListingRequest, validateListingFinancials } from "@pasalo/shared";
import { z } from "zod";
import { pool } from "../../db/pool";

const sellerAgreementSchema = z.object({
  accepted: z.literal(true),
  signedName: z.string().min(2).max(150),
  attorneySignedName: z.string().min(2).max(150),
  commissionRatePct: z.number().min(3).max(5),
  leadValidityMonths: z.number().int().min(6).max(12),
  paymentDueDays: z.number().int().min(1).max(30),
  signatureMethod: z.literal("typed_name_checkbox"),
  attorneySignatureMethod: z.literal("typed_name_checkbox"),
});

const listingViewingAvailabilitySchema = z.object({
  enabled: z.boolean(),
  slots: z.array(z.string().datetime()).max(90).optional(),
  durationMinutes: z.number().int().min(15).max(240).optional(),
  intervalMinutes: z.number().int().min(5).max(240).optional(),
});

const createListingSchema = z.object({
  propertyType: z.enum(["condo", "house_lot", "lot_only"]),
  projectName: z.string().min(2),
  developerName: z.string().min(2),
  locationCity: z.string().min(2),
  locationProvince: z.string().min(2),
  floorAreaSqm: z.number().positive(),
  unitNumber: z
    .string()
    .optional()
    .nullable()
    .transform((value) => {
      if (value == null) {
        return value;
      }
      const trimmed = value.trim();
      return trimmed.length ? trimmed : null;
    }),
  turnoverDate: z.string().optional().nullable(),
  title: z.string().min(10),
  description: z.string().min(20),
  financials: z.object({
    originalPricePhp: z.number().nonnegative(),
    equityPaidPhp: z.number().nonnegative(),
    remainingBalancePhp: z.number().nonnegative(),
    monthlyAmortizationPhp: z.number().nonnegative(),
    cashOutPricePhp: z.number().nonnegative(),
    remainingAmortizationMonths: z.number().int().nonnegative(),
    availableInPagIbig: z.boolean(),
    availableInHouseLoan: z.boolean(),
  }),
  transactionStatus: z.enum(["available", "auctioned", "in_deal", "buying_in_progress", "bought", "released"]).optional(),
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
  isAuctionEnabled: z.boolean().optional(),
  auctionBiddingDays: z.number().int().min(1).max(90).optional(),
  documentAssistance: z
    .object({
      requested: z.boolean(),
      notes: z.string().max(2000).optional().nullable(),
    })
    .optional(),
  viewingAvailability: listingViewingAvailabilitySchema.optional(),
  photoUrls: z.array(z.string().url()).max(15).optional(),
  sellerAgreement: sellerAgreementSchema,
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
const publishListingSchema = z.object({
  publishType: z.enum(["normal", "premium_top"]).default("normal"),
});

const listQuerySchema = z.object({
  q: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  type: z.enum(["condo", "house_lot", "lot_only"]).optional(),
  developer: z.string().optional(),
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
  cashOutMax: z.coerce.number().optional(),
  monthlyMax: z.coerce.number().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
  verifiedOnly: z.coerce.boolean().optional(),
});
const myListingsQuerySchema = z.object({
  status: z.enum(["draft", "pending_review", "live", "paused", "expired", "rejected", "archived"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
const developersQuerySchema = z.object({
  activeOnly: z.coerce.boolean().default(true),
});

export const listingRoutes: FastifyPluginAsync = async (fastify) => {
  const maxPhotoSizeBytes = 5 * 1024 * 1024;
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

  const findActiveDeveloperName = async (name: string): Promise<string | null> => {
    const result = await pool.query(
      `
      select name
      from developers
      where lower(name) = lower($1)
        and is_active = true
      limit 1
    `,
      [name.trim()],
    );

    if (!result.rowCount) {
      return null;
    }

    return result.rows[0].name as string;
  };

  const estimateDataUrlSizeBytes = (value: string): number | null => {
    if (!value.startsWith("data:")) {
      return null;
    }

    const commaIndex = value.indexOf(",");
    if (commaIndex < 0) {
      return null;
    }

    const header = value.slice(0, commaIndex);
    const payload = value.slice(commaIndex + 1);
    if (header.includes(";base64")) {
      const normalizedPayload = payload.replace(/\s+/g, "");
      const padding = normalizedPayload.endsWith("==") ? 2 : normalizedPayload.endsWith("=") ? 1 : 0;
      return Math.max(0, Math.floor((normalizedPayload.length * 3) / 4) - padding);
    }

    return Buffer.byteLength(decodeURIComponent(payload), "utf8");
  };

  const normalizeViewingAvailability = (
    input:
      | {
          enabled: boolean;
          slots?: string[];
          durationMinutes?: number;
          intervalMinutes?: number;
        }
      | undefined,
  ) => {
    const durationMinutes = Math.max(15, Math.min(240, input?.durationMinutes ?? 30));
    const intervalMinutes = Math.max(5, Math.min(240, input?.intervalMinutes ?? 30));

    if (!input) {
      return {
        enabled: false,
        slots: [] as string[],
        durationMinutes,
        intervalMinutes,
      };
    }

    const deduped = Array.from(
      new Set(
        (input.slots ?? [])
          .map((value) => {
            const parsed = new Date(value);
            return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
          })
          .filter((value): value is string => Boolean(value)),
      ),
    )
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())
      .slice(0, 90);

    return {
      enabled: Boolean(input.enabled) && deduped.length > 0,
      slots: deduped,
      durationMinutes,
      intervalMinutes,
    };
  };

  fastify.get("/developers", async (request) => {
    const query = developersQuerySchema.parse(request.query);
    const whereSql = query.activeOnly ? "where is_active = true" : "";

    const result = await pool.query(
      `
      select id, name, is_active, sort_order
      from developers
      ${whereSql}
      order by sort_order asc, name asc
    `,
    );

    return {
      items: result.rows,
    };
  });

  fastify.post(
    "/listings",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      fastify.authorizeRoles(request, ["seller", "agent"]);

      const parsed = createListingSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.code(400).send({
          message: "Validation error",
          details: parsed.error.issues,
        });
      }
      const body = parsed.data;
      const canonicalDeveloperName = await findActiveDeveloperName(body.developerName);
      if (!canonicalDeveloperName) {
        throw fastify.httpErrors.badRequest("Selected developer is not in the active developer catalog.");
      }
      const financialErrors = validateListingFinancials(body.financials);
      if (financialErrors.length) {
        throw fastify.httpErrors.badRequest(financialErrors.join("; "));
      }

      const computed = computeListingFinancials(body.financials);
      const sanitizedPhotoUrls = (body.photoUrls ?? []).map((url) => url.trim()).filter(Boolean);
      for (const photoUrl of sanitizedPhotoUrls) {
        const sizeBytes = estimateDataUrlSizeBytes(photoUrl);
        if (sizeBytes !== null && sizeBytes > maxPhotoSizeBytes) {
          throw fastify.httpErrors.badRequest("Each photo must be 5MB or smaller.");
        }
      }
      const shouldAuction = Boolean(body.isAuctionEnabled) || body.transactionStatus === "auctioned";
      const auctionBiddingDays = shouldAuction ? body.auctionBiddingDays : undefined;
      if (shouldAuction && !auctionBiddingDays) {
        throw fastify.httpErrors.badRequest("auctionBiddingDays is required when auction is enabled");
      }

      const transactionStatus = shouldAuction ? "auctioned" : (body.transactionStatus ?? "available");
      const transferStatus = body.transferStatus ?? "not_started";
      const assistanceRequested = Boolean(body.documentAssistance?.requested);
      const assistanceNotes = assistanceRequested ? (body.documentAssistance?.notes?.trim() ?? null) : null;
      if (assistanceRequested && (!assistanceNotes || assistanceNotes.length < 10)) {
        throw fastify.httpErrors.badRequest(
          "Provide at least 10 characters of notes when requesting document processing assistance.",
        );
      }
      const assistanceStatus = assistanceRequested ? "requested" : "not_requested";
      const viewingAvailability = normalizeViewingAvailability(body.viewingAvailability);
      const auctionStartAt = shouldAuction ? new Date() : null;
      const auctionEndAt =
        shouldAuction && auctionBiddingDays
          ? new Date(auctionStartAt!.getTime() + auctionBiddingDays * 24 * 60 * 60 * 1000)
          : null;
      const sellerAgreement = body.sellerAgreement;
      const leadDefinition =
        "A platform lead means any buyer account that first inquired, requested viewing, or started conversation for this listing through the platform.";
      const commissionClause = `The seller agrees that any buyer introduced through this platform shall be considered a platform lead. If the property is sold to such buyer within ${sellerAgreement.leadValidityMonths} months from introduction, the seller agrees to pay a commission of ${sellerAgreement.commissionRatePct}% of the final selling price.`;
      const paymentClause = `If the seller enters into a sale, contract to sell, or any transfer agreement with a buyer introduced through the platform, the seller shall pay the agreed commission within ${sellerAgreement.paymentDueDays} days of the transaction.`;
      const signerIp = request.ip ?? null;
      const signerUserAgent = request.headers["user-agent"]?.slice(0, 500) ?? null;

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
            readiness_score,
            transaction_status,
            transfer_status,
            auction_enabled,
            auction_start_at,
            auction_end_at,
            auction_bidding_days,
            viewing_availability_enabled,
            viewing_availability_slots,
            viewing_duration_minutes,
            viewing_interval_minutes,
            document_assistance_requested,
            document_assistance_status,
            document_assistance_notes,
            document_assistance_requested_at,
            document_assistance_updated_at
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'draft',now(),30,$12,$13,$14,$15,$16,$17,$18,$19::jsonb,$20,$21,$22,$23,$24,$25,$26)
          returning *
        `,
          [
            request.user.sub,
            body.propertyType,
            body.projectName,
            canonicalDeveloperName,
            body.locationCity,
            body.locationProvince,
            body.floorAreaSqm,
            body.unitNumber ?? null,
            body.turnoverDate ?? null,
            body.title,
            body.description,
            transactionStatus,
            transferStatus,
            shouldAuction,
            auctionStartAt,
            auctionEndAt,
            auctionBiddingDays ?? null,
            viewingAvailability.enabled,
            JSON.stringify(viewingAvailability.slots),
            viewingAvailability.durationMinutes,
            viewingAvailability.intervalMinutes,
            assistanceRequested,
            assistanceStatus,
            assistanceNotes,
            assistanceRequested ? new Date() : null,
            new Date(),
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
            est_total_cost_php,
            remaining_amortization_months,
            available_in_pagibig,
            available_in_house_loan
          )
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        `,
          [
            listing.id,
            body.financials.originalPricePhp,
            body.financials.equityPaidPhp,
            body.financials.remainingBalancePhp,
            body.financials.monthlyAmortizationPhp,
            body.financials.cashOutPricePhp,
            computed.estimatedTotalCostPhp,
            body.financials.remainingAmortizationMonths,
            body.financials.availableInPagIbig,
            body.financials.availableInHouseLoan,
          ],
        );

        await client.query(
          `
          insert into listing_status_events (listing_id, from_status, to_status, changed_by)
          values ($1, null, 'draft', $2)
        `,
          [listing.id, request.user.sub],
        );

        for (let i = 0; i < sanitizedPhotoUrls.length; i += 1) {
          await client.query(
            `
            insert into listing_media (listing_id, media_type, storage_key, is_primary)
            values ($1, 'image', $2, $3)
          `,
            [listing.id, sanitizedPhotoUrls[i], i === 0],
          );
        }

        await client.query(
          `
          insert into listing_seller_agreements (
            listing_id,
            seller_user_id,
            agreement_version,
            commission_rate_pct,
            lead_validity_months,
            payment_due_days,
            lead_definition,
            commission_clause,
            payment_clause,
            signed_name,
            signature_method,
            attorney_signed_name,
            attorney_signature_method,
            signer_ip,
            signer_user_agent
          )
          values ($1,$2,'seller_listing_agreement_v1',$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
        `,
          [
            listing.id,
            request.user.sub,
            sellerAgreement.commissionRatePct,
            sellerAgreement.leadValidityMonths,
            sellerAgreement.paymentDueDays,
            leadDefinition,
            commissionClause,
            paymentClause,
            sellerAgreement.signedName,
            sellerAgreement.signatureMethod,
            sellerAgreement.attorneySignedName,
            sellerAgreement.attorneySignatureMethod,
            signerIp,
            signerUserAgent,
          ],
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

    if (query.q) {
      values.push(`%${query.q}%`);
      whereClauses.push(
        `(l.title ilike $${values.length} or l.project_name ilike $${values.length} or l.developer_name ilike $${values.length} or l.location_city ilike $${values.length} or l.location_province ilike $${values.length})`,
      );
    }
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
    if (query.transactionStatus) {
      values.push(query.transactionStatus);
      whereClauses.push(`l.transaction_status = $${values.length}`);
    }
    if (query.transferStatus) {
      values.push(query.transferStatus);
      whereClauses.push(`l.transfer_status = $${values.length}`);
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
          l.auction_enabled,
          l.auction_end_at,
          l.auction_bidding_days,
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

  fastify.get(
    "/me/listings",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const query = myListingsQuerySchema.parse(request.query);
      const whereClauses: string[] = ["l.owner_user_id = $1"];
      const values: Array<string | number> = [request.user.sub];

      if (query.status) {
        values.push(query.status);
        whereClauses.push(`l.status = $${values.length}`);
      }

      values.push(query.pageSize);
      values.push((query.page - 1) * query.pageSize);

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
          l.readiness_score,
          l.created_at,
          l.is_featured,
          (l.transaction_status = any(array['available'::listing_transaction_status, 'released'::listing_transaction_status])) as is_open_for_new_buyers,
          lf.cash_out_price_php,
          lf.monthly_amortization_php,
          lm.preview_image_url
        from listings l
        join listing_financials lf on lf.listing_id = l.id
        left join lateral (
          select storage_key as preview_image_url
          from listing_media
          where listing_id = l.id and media_type = 'image'
          order by is_primary desc, created_at asc
          limit 1
        ) lm on true
        where ${whereClauses.join(" and ")}
        order by l.created_at desc
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
    },
  );

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
        lf.remaining_amortization_months,
        lf.available_in_pagibig,
        lf.available_in_house_loan,
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
      let normalizedDeveloperName: string | undefined;
      if (body.developerName !== undefined) {
        const activeDeveloperName = await findActiveDeveloperName(body.developerName);
        if (!activeDeveloperName) {
          throw fastify.httpErrors.badRequest("Selected developer is not in the active developer catalog.");
        }
        normalizedDeveloperName = activeDeveloperName;
      }

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
        const value =
          apiField === "developerName"
            ? normalizedDeveloperName
            : body[apiField as keyof typeof body];
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
            remaining_amortization_months = $7,
            available_in_pagibig = $8,
            available_in_house_loan = $9,
            updated_at = now()
          where listing_id = $10
        `,
          [
            body.financials.originalPricePhp,
            body.financials.equityPaidPhp,
            body.financials.remainingBalancePhp,
            body.financials.monthlyAmortizationPhp,
            body.financials.cashOutPricePhp,
            computed.estimatedTotalCostPhp,
            body.financials.remainingAmortizationMonths,
            body.financials.availableInPagIbig,
            body.financials.availableInHouseLoan,
            params.id,
          ],
        );
      }

      if (body.documentAssistance !== undefined) {
        const assistanceRequested = Boolean(body.documentAssistance.requested);
        const assistanceNotes = assistanceRequested ? (body.documentAssistance.notes?.trim() ?? null) : null;
        if (assistanceRequested && (!assistanceNotes || assistanceNotes.length < 10)) {
          throw fastify.httpErrors.badRequest(
            "Provide at least 10 characters of notes when requesting document processing assistance.",
          );
        }

        await pool.query(
          `
          update listings
          set
            document_assistance_requested = $1,
            document_assistance_status = case
              when $1 = false then 'not_requested'
              when document_assistance_status = 'not_requested' then 'requested'
              else document_assistance_status
            end,
            document_assistance_notes = $2,
            document_assistance_requested_at = case
              when $1 = true then coalesce(document_assistance_requested_at, now())
              else null
            end,
            document_assistance_updated_at = now(),
            updated_at = now()
          where id = $3
        `,
          [assistanceRequested, assistanceNotes, params.id],
        );
      }

      if (body.viewingAvailability !== undefined) {
        const viewingAvailability = normalizeViewingAvailability(body.viewingAvailability);
        await pool.query(
          `
          update listings
          set
            viewing_availability_enabled = $1,
            viewing_availability_slots = $2::jsonb,
            viewing_duration_minutes = $3,
            viewing_interval_minutes = $4,
            updated_at = now()
          where id = $5
        `,
          [
            viewingAvailability.enabled,
            JSON.stringify(viewingAvailability.slots),
            viewingAvailability.durationMinutes,
            viewingAvailability.intervalMinutes,
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

  fastify.get(
    "/listings/:id/leads",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);
      const params = z.object({ id: z.string().uuid() }).parse(request.params);

      const listingResult = await pool.query("select id, owner_user_id from listings where id = $1", [params.id]);
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      const isOwner = listing.owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner or admin can view lead records");
      }

      const leadsResult = await pool.query(
        `
        select
          listing_id as property_id,
          buyer_user_id,
          buyer_name,
          buyer_phone as contact_number,
          buyer_email,
          first_inquiry_at as inquiry_date,
          last_activity_at
        from platform_leads
        where listing_id = $1
        order by first_inquiry_at desc
      `,
        [params.id],
      );

      return {
        listingId: params.id,
        items: leadsResult.rows,
      };
    },
  );

  fastify.post(
    "/listings/:id/publish",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = publishListingSchema.parse((request.body ?? {}) as Record<string, unknown>);
      fastify.authorizeRoles(request, ["seller", "agent", "admin"]);

      const ownerResult = await pool.query("select owner_user_id, status from listings where id = $1", [params.id]);
      if (!ownerResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = ownerResult.rows[0];
      const isOwner = listing.owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only listing owner can publish this listing");
      }

      const publishFeePhp = body.publishType === "premium_top" ? 5000 : 1000;
      const shouldFeatureAsTop = body.publishType === "premium_top";

      await pool.query(
        `
        update listings
        set
          status = 'pending_review',
          is_featured = $2,
          updated_at = now()
        where id = $1
      `,
        [params.id, shouldFeatureAsTop],
      );

      await pool.query(
        `
        insert into listing_status_events (listing_id, from_status, to_status, changed_by)
        values ($1, $2, 'pending_review', $3)
      `,
        [params.id, listing.status, request.user.sub],
      );

      await pool.query(
        `
        insert into audit_logs (actor_user_id, action, target_type, target_id, context)
        values ($1, 'listing_publish_requested', 'listing', $2, $3::jsonb)
      `,
        [
          request.user.sub,
          params.id,
          JSON.stringify({
            publishType: body.publishType,
            publishFeePhp,
            placement: shouldFeatureAsTop ? "top" : "normal",
          }),
        ],
      );

      return {
        status: "pending_review",
        publishType: body.publishType,
        publishFeePhp,
        placement: shouldFeatureAsTop ? "top" : "normal",
      };
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

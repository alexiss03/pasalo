import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { PAYMENT_BLOCK_MESSAGE, detectPaymentRelatedContent } from "@pasalo/shared";
import { pool } from "../../db/pool";
import { env } from "../../config/env";

const inquirySchema = z.object({
  message: z.string().min(1).max(1000).optional(),
});

const createConversationSchema = z.object({
  listingId: z.string().uuid(),
  buyerUserId: z.string().uuid().optional(),
});

const createMessageSchema = z.object({
  body: z.string().min(1).max(2000),
  attachmentKey: z.string().max(500).optional(),
});

const createViewingSchema = z.object({
  proposedAt: z.string().datetime(),
  notes: z.string().max(1000).optional(),
});

const patchViewingSchema = z.object({
  status: z.enum(["proposed", "accepted", "rejected", "rescheduled", "completed"]),
  notes: z.string().max(1000).optional(),
});

const createPaymentIntentSchema = z.object({
  amountPhp: z.coerce.number().positive().max(100_000_000),
  note: z.string().max(600).optional(),
});

const patchPaymentIntentSchema = z.object({
  action: z.enum(["pay", "refresh", "cancel"]),
});

const textInputSchema = z.object({
  text: z.string(),
});

type PayMongoCheckoutResponse = {
  data?: {
    id?: string;
    attributes?: {
      checkout_url?: string;
      status?: string;
      payment_intent?: {
        id?: string;
        attributes?: {
          status?: string;
        };
      };
      payments?: Array<{
        id?: string;
        attributes?: {
          status?: string;
        };
      }>;
    };
  };
  errors?: Array<{ detail?: string; code?: string }>;
};

export const interactionRoutes: FastifyPluginAsync = async (fastify) => {
  const openTransactionStatuses = new Set(["available", "released"]);
  const payMongoSecretKey = env.PAYMONGO_SECRET_KEY?.trim() ?? "";
  const payMongoEnabled = payMongoSecretKey.length > 0;
  const payMongoApiBaseUrl = env.PAYMONGO_API_BASE_URL.replace(/\/$/, "");
  const payMongoPaymentMethodTypes = env.PAYMONGO_PAYMENT_METHOD_TYPES.split(",")
    .map((method) => method.trim())
    .filter(Boolean);
  const payMongoAuthHeader = payMongoEnabled
    ? `Basic ${Buffer.from(`${payMongoSecretKey}:`).toString("base64")}`
    : "";

  const toMinorUnitPhp = (amountPhp: number) => Math.round(amountPhp * 100);

  const parsePayMongoError = (payload: PayMongoCheckoutResponse | null, fallback: string) => {
    const detail = payload?.errors?.[0]?.detail?.trim();
    return detail?.length ? detail : fallback;
  };

  const getCheckoutStatus = (payload: PayMongoCheckoutResponse | null): string => {
    return payload?.data?.attributes?.status?.toString() ?? "unknown";
  };

  const extractPayMongoPaymentIntentId = (payload: PayMongoCheckoutResponse | null): string | null => {
    return payload?.data?.attributes?.payment_intent?.id?.toString() ?? null;
  };

  const isCheckoutPaid = (payload: PayMongoCheckoutResponse | null): boolean => {
    const checkoutStatus = payload?.data?.attributes?.status?.toLowerCase();
    if (checkoutStatus === "paid") {
      return true;
    }

    const paymentIntentStatus = payload?.data?.attributes?.payment_intent?.attributes?.status?.toLowerCase();
    if (paymentIntentStatus === "succeeded" || paymentIntentStatus === "paid") {
      return true;
    }

    const payments = payload?.data?.attributes?.payments ?? [];
    return payments.some((item) => {
      const status = item.attributes?.status?.toLowerCase();
      return status === "paid" || status === "succeeded";
    });
  };

  const createPayMongoCheckout = async (payload: {
    paymentIntentId: string;
    conversationId: string;
    listingId: string;
    amountPhp: number;
    note?: string | null;
    payerName: string;
    payerEmail: string;
    payerPhone: string;
  }) => {
    if (!payMongoEnabled) {
      throw fastify.httpErrors.serviceUnavailable(
        "PayMongo is not configured. Set PAYMONGO_SECRET_KEY in the API environment.",
      );
    }
    if (!payMongoPaymentMethodTypes.length) {
      throw fastify.httpErrors.serviceUnavailable(
        "PayMongo payment methods are not configured. Set PAYMONGO_PAYMENT_METHOD_TYPES in the API environment.",
      );
    }

    const amountMinor = toMinorUnitPhp(payload.amountPhp);
    if (amountMinor < 100) {
      throw fastify.httpErrors.badRequest("Minimum PayMongo payment amount is PHP 1.00.");
    }

    const response = await fetch(`${payMongoApiBaseUrl}/checkout_sessions`, {
      method: "POST",
      headers: {
        Authorization: payMongoAuthHeader,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        data: {
          attributes: {
            billing: {
              name: payload.payerName,
              email: payload.payerEmail,
              phone: payload.payerPhone,
            },
            send_email_receipt: false,
            show_description: true,
            show_line_items: true,
            line_items: [
              {
                currency: "PHP",
                amount: amountMinor,
                name: "Pasalo In-App Payment",
                quantity: 1,
                description: payload.note ?? `Payment intent ${payload.paymentIntentId}`,
              },
            ],
            payment_method_types: payMongoPaymentMethodTypes,
            description: `Pasalo payment for listing ${payload.listingId}`,
            success_url: `${env.PAYMONGO_PUBLIC_BASE_URL}/messages/${payload.conversationId}?payment=success&paymentIntentId=${payload.paymentIntentId}`,
            cancel_url: `${env.PAYMONGO_PUBLIC_BASE_URL}/messages/${payload.conversationId}?payment=cancel&paymentIntentId=${payload.paymentIntentId}`,
            metadata: {
              payment_intent_id: payload.paymentIntentId,
              conversation_id: payload.conversationId,
              listing_id: payload.listingId,
            },
          },
        },
      }),
    });

    const result = (await response.json().catch(() => null)) as PayMongoCheckoutResponse | null;
    if (!response.ok) {
      throw fastify.httpErrors.badGateway(
        parsePayMongoError(result, "Failed to create PayMongo checkout session."),
      );
    }

    const checkoutId = result?.data?.id?.toString();
    const checkoutUrl = result?.data?.attributes?.checkout_url?.toString();
    if (!checkoutId || !checkoutUrl) {
      throw fastify.httpErrors.badGateway("PayMongo checkout response is missing checkout URL.");
    }

    return {
      checkoutId,
      checkoutUrl,
      checkoutStatus: getCheckoutStatus(result),
      payMongoPaymentIntentId: extractPayMongoPaymentIntentId(result),
      raw: result,
    };
  };

  const retrievePayMongoCheckout = async (checkoutId: string) => {
    if (!payMongoEnabled) {
      throw fastify.httpErrors.serviceUnavailable(
        "PayMongo is not configured. Set PAYMONGO_SECRET_KEY in the API environment.",
      );
    }

    const response = await fetch(`${payMongoApiBaseUrl}/checkout_sessions/${checkoutId}`, {
      method: "GET",
      headers: {
        Authorization: payMongoAuthHeader,
        "Content-Type": "application/json",
      },
    });

    const result = (await response.json().catch(() => null)) as PayMongoCheckoutResponse | null;
    if (!response.ok) {
      throw fastify.httpErrors.badGateway(
        parsePayMongoError(result, "Failed to retrieve PayMongo checkout status."),
      );
    }

    return {
      checkoutStatus: getCheckoutStatus(result),
      payMongoPaymentIntentId: extractPayMongoPaymentIntentId(result),
      paid: isCheckoutPaid(result),
      raw: result,
    };
  };

  const assertNoPaymentText = (value: string | undefined) => {
    if (!value) {
      return;
    }

    const parsed = textInputSchema.parse({ text: value });
    const detection = detectPaymentRelatedContent(parsed.text);
    if (detection.blocked) {
      throw fastify.httpErrors.unprocessableEntity(PAYMENT_BLOCK_MESSAGE);
    }
  };

  const upsertLeadRecord = async (listingId: string, buyerUserId: string) => {
    await pool.query(
      `
      insert into platform_leads (
        listing_id,
        buyer_user_id,
        buyer_name,
        buyer_phone,
        buyer_email,
        source,
        first_inquiry_at,
        last_activity_at,
        updated_at
      )
      select
        $1,
        u.id,
        p.full_name,
        p.phone,
        u.email,
        'platform',
        now(),
        now(),
        now()
      from users u
      left join profiles p on p.user_id = u.id
      where u.id = $2
      on conflict (listing_id, buyer_user_id)
      do update set
        buyer_name = coalesce(excluded.buyer_name, platform_leads.buyer_name),
        buyer_phone = coalesce(excluded.buyer_phone, platform_leads.buyer_phone),
        buyer_email = excluded.buyer_email,
        last_activity_at = now(),
        updated_at = now()
    `,
      [listingId, buyerUserId],
    );
  };

  const getConversationForUser = async (conversationId: string, userId: string, role: string) => {
    const convoResult = await pool.query(
      `
      select
        c.id,
        c.listing_id,
        c.buyer_user_id,
        c.seller_user_id,
        l.title as listing_title
      from conversations c
      join listings l on l.id = c.listing_id
      where c.id = $1
    `,
      [conversationId],
    );

    if (!convoResult.rowCount) {
      throw fastify.httpErrors.notFound("Conversation not found");
    }

    const convo = convoResult.rows[0];
    const participant = [convo.buyer_user_id, convo.seller_user_id].includes(userId);
    if (!participant && role !== "admin") {
      throw fastify.httpErrors.forbidden("Not allowed to access this conversation");
    }

    return convo;
  };

  const assertListingOpenForBuyer = (
    listing: {
      owner_user_id: string;
      transaction_status: string;
      active_buyer_user_id: string | null;
    },
    actorUserId: string,
    actorRole: string,
    buyerUserId: string,
  ) => {
    if (openTransactionStatuses.has(listing.transaction_status)) {
      return;
    }

    if (actorRole === "admin") {
      return;
    }

    if (actorUserId === listing.owner_user_id) {
      return;
    }

    if (listing.active_buyer_user_id && buyerUserId === listing.active_buyer_user_id) {
      return;
    }

    throw fastify.httpErrors.conflict(
      `Listing is currently ${listing.transaction_status} and unavailable to other buyers`,
    );
  };

  fastify.post(
    "/listings/:id/inquiries",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = inquirySchema.parse(request.body);
      assertNoPaymentText(body.message);

      fastify.authorizeRoles(request, ["buyer", "agent", "seller", "admin"]);

      const listingResult = await pool.query(
        "select id, owner_user_id, transaction_status, active_buyer_user_id from listings where id = $1",
        [params.id],
      );
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }
      const listing = listingResult.rows[0];
      assertListingOpenForBuyer(listing, request.user.sub, request.user.role, request.user.sub);

      const result = await pool.query(
        `
        insert into inquiries (listing_id, buyer_user_id, message)
        values ($1, $2, $3)
        returning id, listing_id, buyer_user_id, status, created_at
      `,
        [params.id, request.user.sub, body.message ?? null],
      );

      await upsertLeadRecord(params.id, request.user.sub);

      return reply.code(201).send(result.rows[0]);
    },
  );

  fastify.get(
    "/inquiries",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      if (request.user.role === "buyer") {
        const result = await pool.query(
          `
          select i.*, l.title, l.location_city, l.location_province
          from inquiries i
          join listings l on l.id = i.listing_id
          where i.buyer_user_id = $1
          order by i.created_at desc
        `,
          [request.user.sub],
        );

        return { items: result.rows };
      }

      const result = await pool.query(
        `
        select i.*, l.title, l.location_city, l.location_province
        from inquiries i
        join listings l on l.id = i.listing_id
        where l.owner_user_id = $1
        order by i.created_at desc
      `,
        [request.user.sub],
      );

      return { items: result.rows };
    },
  );

  fastify.post(
    "/conversations",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = createConversationSchema.parse(request.body);
      const listingResult = await pool.query(
        "select id, owner_user_id, transaction_status, active_buyer_user_id from listings where id = $1",
        [body.listingId],
      );

      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      const buyerUserId = request.user.role === "buyer" ? request.user.sub : body.buyerUserId;

      if (!buyerUserId) {
        throw fastify.httpErrors.badRequest("buyerUserId is required for non-buyer roles");
      }

      const existing = await pool.query(
        `
        select id, listing_id, buyer_user_id, seller_user_id, created_at
        from conversations
        where listing_id = $1 and buyer_user_id = $2 and seller_user_id = $3
      `,
        [body.listingId, buyerUserId, listing.owner_user_id],
      );

      if (existing.rowCount) {
        await upsertLeadRecord(body.listingId, buyerUserId);
        return existing.rows[0];
      }

      assertListingOpenForBuyer(listing, request.user.sub, request.user.role, buyerUserId);

      const inserted = await pool.query(
        `
        insert into conversations (listing_id, buyer_user_id, seller_user_id)
        values ($1, $2, $3)
        returning id, listing_id, buyer_user_id, seller_user_id, created_at
      `,
        [body.listingId, buyerUserId, listing.owner_user_id],
      );

      await upsertLeadRecord(body.listingId, buyerUserId);

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.get(
    "/conversations",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await pool.query(
        `
        select
          c.id,
          c.listing_id,
          c.buyer_user_id,
          c.seller_user_id,
          c.created_at,
          l.title as listing_title,
          pb.full_name as buyer_name,
          ps.full_name as seller_name,
          lm.body as last_message_body,
          lm.created_at as last_message_at,
          coalesce(uc.unread_count, 0) as unread_count
        from conversations c
        join listings l on l.id = c.listing_id
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
          select count(*)::int as unread_count
          from messages mu
          where
            mu.conversation_id = c.id
            and mu.sender_user_id <> $1
            and mu.read_at is null
        ) uc on true
        where c.buyer_user_id = $1 or c.seller_user_id = $1 or $2 = 'admin'
        order by coalesce(lm.created_at, c.created_at) desc
      `,
        [request.user.sub, request.user.role],
      );

      return { items: result.rows };
    },
  );

  fastify.get(
    "/conversations/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const convo = await getConversationForUser(params.id, request.user.sub, request.user.role);

      const profileResult = await pool.query(
        `
        select user_id, full_name
        from profiles
        where user_id = any($1::uuid[])
      `,
        [[convo.buyer_user_id, convo.seller_user_id]],
      );

      const names = new Map<string, string>();
      for (const row of profileResult.rows) {
        names.set(row.user_id, row.full_name);
      }

      return {
        id: convo.id,
        listing_id: convo.listing_id,
        listing_title: convo.listing_title,
        buyer_user_id: convo.buyer_user_id,
        seller_user_id: convo.seller_user_id,
        buyer_name: names.get(convo.buyer_user_id) ?? "Buyer",
        seller_name: names.get(convo.seller_user_id) ?? "Seller",
      };
    },
  );

  fastify.get(
    "/conversations/:id/messages",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const query = z
        .object({
          markRead: z.coerce.boolean().default(true),
        })
        .parse(request.query);
      await getConversationForUser(params.id, request.user.sub, request.user.role);

      let markedReadCount = 0;
      if (query.markRead && request.user.role !== "admin") {
        const markReadResult = await pool.query(
          `
          update messages
          set read_at = now()
          where conversation_id = $1 and sender_user_id <> $2 and read_at is null
          returning id
        `,
          [params.id, request.user.sub],
        );
        markedReadCount = markReadResult.rowCount ?? 0;
      }

      const result = await pool.query(
        `
        select id, conversation_id, sender_user_id, body, attachment_key, created_at, read_at
        from messages
        where conversation_id = $1
        order by created_at asc
      `,
        [params.id],
      );

      return { items: result.rows, markedReadCount };
    },
  );

  fastify.post(
    "/conversations/:id/messages",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = createMessageSchema.parse(request.body);
      assertNoPaymentText(body.body);

      await getConversationForUser(params.id, request.user.sub, request.user.role);

      const inserted = await pool.query(
        `
        insert into messages (conversation_id, sender_user_id, body, attachment_key)
        values ($1, $2, $3, $4)
        returning id, conversation_id, sender_user_id, body, attachment_key, created_at
      `,
        [params.id, request.user.sub, body.body, body.attachmentKey ?? null],
      );

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.post(
    "/listings/:id/viewing-requests",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = createViewingSchema.parse(request.body);
      assertNoPaymentText(body.notes);

      const listingResult = await pool.query(
        "select owner_user_id, transaction_status, active_buyer_user_id from listings where id = $1",
        [params.id],
      );
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      assertListingOpenForBuyer(listing, request.user.sub, request.user.role, request.user.sub);

      const sellerUserId = listing.owner_user_id;

      const inserted = await pool.query(
        `
        insert into viewing_requests (listing_id, buyer_user_id, seller_user_id, proposed_at, notes)
        values ($1, $2, $3, $4, $5)
        returning id, listing_id, buyer_user_id, seller_user_id, proposed_at, status, notes, created_at
      `,
        [params.id, request.user.sub, sellerUserId, body.proposedAt, body.notes ?? null],
      );

      await upsertLeadRecord(params.id, request.user.sub);

      return reply.code(201).send(inserted.rows[0]);
    },
  );

  fastify.patch(
    "/viewing-requests/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchViewingSchema.parse(request.body);
      assertNoPaymentText(body.notes);

      const existing = await pool.query(
        "select id, buyer_user_id, seller_user_id from viewing_requests where id = $1",
        [params.id],
      );

      if (!existing.rowCount) {
        throw fastify.httpErrors.notFound("Viewing request not found");
      }

      const row = existing.rows[0];
      const participant = [row.buyer_user_id, row.seller_user_id].includes(request.user.sub);
      if (!participant && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Not allowed to update this viewing request");
      }

      const updated = await pool.query(
        `
        update viewing_requests
        set status = $1, notes = coalesce($2, notes)
        where id = $3
        returning id, listing_id, buyer_user_id, seller_user_id, proposed_at, status, notes, created_at
      `,
        [body.status, body.notes ?? null, params.id],
      );

      return updated.rows[0];
    },
  );

  fastify.get(
    "/conversations/:id/payment-intents",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      await getConversationForUser(params.id, request.user.sub, request.user.role);

      const result = await pool.query(
        `
        select
          id,
          conversation_id,
          listing_id,
          requested_by_user_id,
          payer_user_id,
          payee_user_id,
          amount_php,
          note,
          status,
          paid_at,
          canceled_at,
          paymongo_checkout_id,
          paymongo_checkout_url,
          paymongo_last_status,
          paymongo_payment_intent_id,
          created_at,
          updated_at
        from payment_intents
        where conversation_id = $1
        order by created_at desc
      `,
        [params.id],
      );

      return { items: result.rows };
    },
  );

  fastify.post(
    "/conversations/:id/payment-intents",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = createPaymentIntentSchema.parse(request.body);
      const convo = await getConversationForUser(params.id, request.user.sub, request.user.role);

      if (request.user.role !== "seller" && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("Only sellers or admins can create payment requests");
      }

      if (request.user.role !== "admin" && convo.seller_user_id !== request.user.sub) {
        throw fastify.httpErrors.forbidden("Only the listing seller can create payment requests");
      }

      const payerProfileResult = await pool.query(
        `
        select
          u.email,
          coalesce(p.full_name, 'Buyer') as full_name,
          coalesce(p.phone, '') as phone
        from users u
        left join profiles p on p.user_id = u.id
        where u.id = $1
      `,
        [convo.buyer_user_id],
      );
      if (!payerProfileResult.rowCount) {
        throw fastify.httpErrors.notFound("Buyer account not found");
      }
      const payer = payerProfileResult.rows[0];

      const inserted = await pool.query(
        `
        insert into payment_intents (
          conversation_id,
          listing_id,
          requested_by_user_id,
          payer_user_id,
          payee_user_id,
          amount_php,
          note,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'pending')
        returning
          id,
          conversation_id,
          listing_id,
          requested_by_user_id,
          payer_user_id,
          payee_user_id,
          amount_php,
          note,
          status,
          paid_at,
          canceled_at,
          paymongo_checkout_id,
          paymongo_checkout_url,
          paymongo_last_status,
          paymongo_payment_intent_id,
          created_at,
          updated_at
      `,
        [
          convo.id,
          convo.listing_id,
          request.user.sub,
          convo.buyer_user_id,
          convo.seller_user_id,
          body.amountPhp,
          body.note ?? null,
        ],
      );

      const paymentIntent = inserted.rows[0];

      try {
        const checkout = await createPayMongoCheckout({
          paymentIntentId: paymentIntent.id,
          conversationId: convo.id,
          listingId: convo.listing_id,
          amountPhp: Number(paymentIntent.amount_php),
          note: paymentIntent.note,
          payerName: String(payer.full_name ?? "Buyer"),
          payerEmail: String(payer.email),
          payerPhone: String(payer.phone ?? ""),
        });

        const updated = await pool.query(
          `
          update payment_intents
          set
            paymongo_checkout_id = $1,
            paymongo_checkout_url = $2,
            paymongo_last_status = $3,
            paymongo_payment_intent_id = $4,
            paymongo_raw = $5::jsonb,
            updated_at = now()
          where id = $6
          returning
            id,
            conversation_id,
            listing_id,
            requested_by_user_id,
            payer_user_id,
            payee_user_id,
            amount_php,
            note,
            status,
            paid_at,
            canceled_at,
            paymongo_checkout_id,
            paymongo_checkout_url,
            paymongo_last_status,
            paymongo_payment_intent_id,
            created_at,
            updated_at
        `,
          [
            checkout.checkoutId,
            checkout.checkoutUrl,
            checkout.checkoutStatus,
            checkout.payMongoPaymentIntentId,
            JSON.stringify(checkout.raw),
            paymentIntent.id,
          ],
        );

        return reply.code(201).send(updated.rows[0]);
      } catch (error) {
        await pool.query("delete from payment_intents where id = $1", [paymentIntent.id]);
        throw error;
      }
    },
  );

  fastify.patch(
    "/payment-intents/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ id: z.string().uuid() }).parse(request.params);
      const body = patchPaymentIntentSchema.parse(request.body);

      const existing = await pool.query(
        `
        select
          id,
          conversation_id,
          listing_id,
          payer_user_id,
          payee_user_id,
          status,
          paymongo_checkout_id,
          paymongo_checkout_url
        from payment_intents
        where id = $1
      `,
        [params.id],
      );

      if (!existing.rowCount) {
        throw fastify.httpErrors.notFound("Payment intent not found");
      }

      const row = existing.rows[0];
      await getConversationForUser(row.conversation_id, request.user.sub, request.user.role);

      if (row.status !== "pending") {
        throw fastify.httpErrors.badRequest("Only pending payment intents can be updated");
      }

      if (body.action === "pay" || body.action === "refresh") {
        if (request.user.role !== "admin" && request.user.sub !== row.payer_user_id) {
          throw fastify.httpErrors.forbidden("Only the payer can complete this payment");
        }

        if (!row.paymongo_checkout_id) {
          throw fastify.httpErrors.badRequest("Missing PayMongo checkout session for this payment intent.");
        }

        const checkout = await retrievePayMongoCheckout(row.paymongo_checkout_id);

        if (!checkout.paid) {
          const pending = await pool.query(
            `
            update payment_intents
            set
              paymongo_last_status = $1,
              paymongo_payment_intent_id = coalesce($2, paymongo_payment_intent_id),
              paymongo_raw = $3::jsonb,
              updated_at = now()
            where id = $4
            returning
              id,
              conversation_id,
              listing_id,
              requested_by_user_id,
              payer_user_id,
              payee_user_id,
              amount_php,
              note,
              status,
              paid_at,
              canceled_at,
              paymongo_checkout_id,
              paymongo_checkout_url,
              paymongo_last_status,
              paymongo_payment_intent_id,
              created_at,
              updated_at
          `,
            [
              checkout.checkoutStatus,
              checkout.payMongoPaymentIntentId,
              JSON.stringify(checkout.raw),
              params.id,
            ],
          );

          return pending.rows[0];
        }

        const updated = await pool.query(
          `
          update payment_intents
          set
            status = 'paid',
            paid_at = now(),
            paymongo_last_status = $2,
            paymongo_payment_intent_id = coalesce($3, paymongo_payment_intent_id),
            paymongo_raw = $4::jsonb,
            updated_at = now()
          where id = $1
          returning
            id,
            conversation_id,
            listing_id,
            requested_by_user_id,
            payer_user_id,
            payee_user_id,
            amount_php,
            note,
            status,
            paid_at,
            canceled_at,
            paymongo_checkout_id,
            paymongo_checkout_url,
            paymongo_last_status,
            paymongo_payment_intent_id,
            created_at,
            updated_at
        `,
          [
            params.id,
            checkout.checkoutStatus,
            checkout.payMongoPaymentIntentId,
            JSON.stringify(checkout.raw),
          ],
        );

        return updated.rows[0];
      }

      if (
        request.user.role !== "admin" &&
        request.user.sub !== row.payee_user_id &&
        request.user.sub !== row.payer_user_id
      ) {
        throw fastify.httpErrors.forbidden("Only payer, payee, or admin can cancel this payment request");
      }

      const updated = await pool.query(
        `
        update payment_intents
        set status = 'canceled', canceled_at = now(), updated_at = now()
        where id = $1
        returning
          id,
          conversation_id,
          listing_id,
          requested_by_user_id,
          payer_user_id,
          payee_user_id,
          amount_php,
          note,
          status,
          paid_at,
          canceled_at,
          paymongo_checkout_id,
          paymongo_checkout_url,
          paymongo_last_status,
          paymongo_payment_intent_id,
          created_at,
          updated_at
      `,
        [params.id],
      );

      return updated.rows[0];
    },
  );

  fastify.post(
    "/watchlist/:listingId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const params = z.object({ listingId: z.string().uuid() }).parse(request.params);

      const inserted = await pool.query(
        `
        insert into watchlists (user_id, listing_id)
        values ($1, $2)
        on conflict (user_id, listing_id) do nothing
        returning id, user_id, listing_id, created_at
      `,
        [request.user.sub, params.listingId],
      );

      return reply.code(201).send(inserted.rows[0] ?? { alreadyExists: true });
    },
  );

  fastify.delete(
    "/watchlist/:listingId",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = z.object({ listingId: z.string().uuid() }).parse(request.params);
      await pool.query("delete from watchlists where user_id = $1 and listing_id = $2", [request.user.sub, params.listingId]);
      return { removed: true };
    },
  );

  fastify.get(
    "/watchlist",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await pool.query(
        `
        select
          w.created_at as saved_at,
          l.id,
          l.title,
          l.location_city,
          l.location_province,
          l.property_type,
          lf.cash_out_price_php,
          lf.monthly_amortization_php,
          l.status
        from watchlists w
        join listings l on l.id = w.listing_id
        join listing_financials lf on lf.listing_id = l.id
        where w.user_id = $1
        order by w.created_at desc
      `,
        [request.user.sub],
      );

      return { items: result.rows };
    },
  );
};

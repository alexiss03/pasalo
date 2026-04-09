import { FastifyPluginAsync } from "fastify";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { pool } from "../../db/pool";
import {
  assessDocumentAuthenticity,
  assessSelfieAuthenticity,
  verificationDocTypes,
} from "./documentAuth";
import type { AiDocAuthStatus, VerificationDocType } from "./documentAuth";
import { estimateDataUrlBytes, uploadDataUrlAsset } from "../../lib/storage";

const updateProfileSchema = z.object({
  fullName: z.string().min(2).optional(),
  phone: z.string().min(8).optional(),
  city: z.string().min(2).optional(),
});

const verificationDocSchema = z.object({
  listingId: z.string().uuid(),
  docType: z.enum(verificationDocTypes),
  fileKey: z.string().min(3),
});

const verificationBatchSchema = z.object({
  listingId: z.string().uuid(),
  idFileKey: z.string().min(3),
  transferDocumentFileKey: z.string().min(3),
  titleDeclarationFileKey: z.string().min(3),
  authorityDocumentFileKey: z.string().min(3),
});

const roleApplicationSchema = z.object({
  requestedRole: z.enum(["buyer", "seller", "agent", "attorney"]),
  reason: z.string().min(10).max(4000),
});

const identityVerificationSchema = z.object({
  idFileKey: z.string().min(3),
  selfieFileKey: z.string().min(3),
  authorityDocumentFileKey: z.string().min(3).optional().nullable(),
});
const mobileCaptureFieldSchema = z.enum(["id", "selfie", "authority_document"]);
const createMobileCaptureSessionSchema = z.object({
  field: mobileCaptureFieldSchema,
});
const mobileCaptureSessionParamsSchema = z.object({
  id: z.string().uuid(),
});
const mobileCaptureSessionTokenSchema = z.object({
  token: z.string().min(20),
});
const completeMobileCaptureSchema = z.object({
  token: z.string().min(20),
  imageDataUrl: z.string().min(50),
  fileName: z.string().max(180).optional(),
});

type QueryRunner = {
  query: (text: string, params?: unknown[]) => Promise<{ rowCount: number; rows: Record<string, unknown>[] }>;
};

async function upsertVerificationDocument(
  runner: QueryRunner,
  payload: {
    listingId: string;
    userId: string;
    docType: VerificationDocType;
    fileKey: string;
  },
) {
  const assessment = assessDocumentAuthenticity(payload.docType, payload.fileKey);
  const existing = await runner.query(
    `
      select id
      from listing_verifications
      where listing_id = $1 and user_id = $2 and doc_type = $3 and status = 'pending'
      order by created_at desc
      limit 1
    `,
    [payload.listingId, payload.userId, payload.docType],
  );

  if (existing.rowCount) {
    const updated = await runner.query(
      `
        update listing_verifications
        set
          file_key = $1,
          ai_auth_status = $2,
          ai_confidence = $3,
          ai_flags = $4,
          ai_checked_at = now(),
          rejection_reason = null
        where id = $5
        returning id, listing_id, user_id, doc_type, file_key, status, ai_auth_status, ai_confidence, ai_flags, ai_checked_at, created_at
      `,
      [payload.fileKey, assessment.aiAuthStatus, assessment.aiConfidence, assessment.aiFlags, existing.rows[0].id],
    );

    return updated.rows[0];
  }

  const inserted = await runner.query(
    `
      insert into listing_verifications (
        listing_id,
        user_id,
        doc_type,
        file_key,
        status,
        ai_auth_status,
        ai_confidence,
        ai_flags,
        ai_checked_at
      )
      values ($1, $2, $3, $4, 'pending', $5, $6, $7, now())
      returning id, listing_id, user_id, doc_type, file_key, status, ai_auth_status, ai_confidence, ai_flags, ai_checked_at, created_at
    `,
    [payload.listingId, payload.userId, payload.docType, payload.fileKey, assessment.aiAuthStatus, assessment.aiConfidence, assessment.aiFlags],
  );

  return inserted.rows[0];
}

function generatePlatformIdentityCode() {
  const year = new Date().getUTCFullYear();
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `PAS-ID-${year}-${suffix}`;
}

function generateCaptureSessionToken() {
  return randomBytes(24).toString("hex");
}

export const profileRoutes: FastifyPluginAsync = async (fastify) => {
  const mobileCaptureMaxBytes = 10 * 1024 * 1024;
  const mobileCaptureSessionMinutes = 20;

  const getSessionState = async (
    payload: { id: string; token?: string; userId?: string },
  ): Promise<Record<string, unknown> | null> => {
    const values: string[] = [payload.id];
    const whereClauses = ["id = $1"];

    if (payload.token !== undefined) {
      values.push(payload.token);
      whereClauses.push(`session_token = $${values.length}`);
    }
    if (payload.userId !== undefined) {
      values.push(payload.userId);
      whereClauses.push(`user_id = $${values.length}`);
    }

    const result = await pool.query(
      `
      select
        id,
        user_id,
        field_type,
        status,
        session_token,
        captured_file_key,
        captured_file_name,
        expires_at,
        captured_at,
        created_at,
        updated_at
      from mobile_capture_sessions
      where ${whereClauses.join(" and ")}
      limit 1
    `,
      values,
    );

    if (!result.rowCount) {
      return null;
    }

    const session = result.rows[0];
    const isExpired = new Date(String(session.expires_at)).getTime() < Date.now();
    if (session.status === "pending" && isExpired) {
      const updated = await pool.query(
        `
        update mobile_capture_sessions
        set status = 'expired', updated_at = now()
        where id = $1
        returning
          id,
          user_id,
          field_type,
          status,
          session_token,
          captured_file_key,
          captured_file_name,
          expires_at,
          captured_at,
          created_at,
          updated_at
      `,
        [session.id],
      );
      return updated.rows[0] ?? session;
    }

    return session;
  };

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
          p.verification_badge_shown,
          piv.platform_identity_code,
          piv.status as identity_review_status,
          piv.ai_auth_status as identity_ai_status,
          piv.created_at as identity_submitted_at
        from users u
        left join profiles p on p.user_id = u.id
        left join lateral (
          select
            platform_identity_code,
            status,
            ai_auth_status,
            created_at
          from profile_identity_verifications
          where user_id = u.id
          order by created_at desc
          limit 1
        ) piv on true
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

  fastify.get(
    "/me/identity-verification",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const result = await pool.query(
        `
        select
          id,
          platform_identity_code,
          provider,
          status,
          ai_auth_status,
          ai_confidence,
          ai_flags,
          created_at,
          updated_at
        from profile_identity_verifications
        where user_id = $1
        order by created_at desc
        limit 1
      `,
        [request.user.sub],
      );

      return {
        item: result.rows[0] ?? null,
      };
    },
  );

  fastify.post(
    "/me/mobile-capture-sessions",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = createMobileCaptureSessionSchema.parse(request.body);
      const expiresAt = new Date(Date.now() + mobileCaptureSessionMinutes * 60 * 1000);
      const token = generateCaptureSessionToken();

      const inserted = await pool.query(
        `
        insert into mobile_capture_sessions (
          user_id,
          field_type,
          session_token,
          status,
          expires_at
        )
        values ($1, $2, $3, 'pending', $4)
        returning
          id,
          user_id,
          field_type,
          status,
          session_token,
          expires_at,
          created_at,
          updated_at
      `,
        [request.user.sub, body.field, token, expiresAt],
      );

      return reply.code(201).send({
        item: {
          ...inserted.rows[0],
          token: inserted.rows[0].session_token,
        },
      });
    },
  );

  fastify.get(
    "/me/mobile-capture-sessions/:id",
    {
      preHandler: [fastify.authenticate],
    },
    async (request) => {
      const params = mobileCaptureSessionParamsSchema.parse(request.params);
      const item = await getSessionState({ id: params.id, userId: request.user.sub });
      if (!item) {
        throw fastify.httpErrors.notFound("Capture session not found");
      }

      return {
        item: {
          id: item.id,
          field_type: item.field_type,
          status: item.status,
          captured_file_key: item.captured_file_key,
          captured_file_name: item.captured_file_name,
          expires_at: item.expires_at,
          captured_at: item.captured_at,
          created_at: item.created_at,
          updated_at: item.updated_at,
        },
      };
    },
  );

  fastify.get("/mobile-capture-sessions/:id", async (request) => {
    const params = mobileCaptureSessionParamsSchema.parse(request.params);
    const query = mobileCaptureSessionTokenSchema.parse(request.query);
    const item = await getSessionState({ id: params.id, token: query.token });
    if (!item) {
      throw fastify.httpErrors.notFound("Capture session not found");
    }

    return {
      item: {
        id: item.id,
        field_type: item.field_type,
        status: item.status,
        expires_at: item.expires_at,
        captured_at: item.captured_at,
      },
    };
  });

  fastify.post("/mobile-capture-sessions/:id/complete", async (request, reply) => {
    const params = mobileCaptureSessionParamsSchema.parse(request.params);
    const body = completeMobileCaptureSchema.parse(request.body);
    const item = await getSessionState({ id: params.id, token: body.token });
    if (!item) {
      throw fastify.httpErrors.notFound("Capture session not found");
    }

    if (item.status === "completed") {
      throw fastify.httpErrors.conflict("Capture session already completed");
    }
    if (item.status !== "pending") {
      throw fastify.httpErrors.conflict(`Capture session is ${item.status}`);
    }

    const imageDataUrl = body.imageDataUrl.trim();
    if (!imageDataUrl.startsWith("data:image/")) {
      throw fastify.httpErrors.badRequest("imageDataUrl must be an image data URL");
    }

    const sizeBytes = estimateDataUrlBytes(imageDataUrl);
    if (sizeBytes === null) {
      throw fastify.httpErrors.badRequest("Invalid imageDataUrl format");
    }
    if (sizeBytes > mobileCaptureMaxBytes) {
      throw fastify.httpErrors.badRequest("Captured image must be 10MB or smaller");
    }

    const fieldType = String(item.field_type) as z.infer<typeof mobileCaptureFieldSchema>;
    const uploadKind =
      fieldType === "id"
        ? "identity_id"
        : fieldType === "selfie"
          ? "identity_selfie"
          : "identity_authority";

    const uploaded = await uploadDataUrlAsset({
      kind: uploadKind,
      dataUrl: imageDataUrl,
      fileName: body.fileName,
      userId: String(item.user_id),
    });

    const updated = await pool.query(
      `
      update mobile_capture_sessions
      set
        status = 'completed',
        captured_file_key = $2,
        captured_file_name = $3,
        captured_at = now(),
        updated_at = now()
      where id = $1
      returning
        id,
        field_type,
        status,
        captured_file_key,
        captured_file_name,
        expires_at,
        captured_at,
        created_at,
        updated_at
    `,
      [params.id, uploaded.storageKey, uploaded.fileName],
    );

    return reply.code(201).send({
      item: updated.rows[0],
    });
  });

  fastify.post(
    "/me/identity-verification",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = identityVerificationSchema.parse(request.body);
      const idAssessment = assessDocumentAuthenticity("id", body.idFileKey);
      const selfieAssessment = assessSelfieAuthenticity(body.selfieFileKey);
      const authorityAssessment = body.authorityDocumentFileKey
        ? assessDocumentAuthenticity("authority_document", body.authorityDocumentFileKey)
        : null;

      const assessments: Array<{ scope: string; value: ReturnType<typeof assessDocumentAuthenticity> }> = [
        { scope: "id", value: idAssessment },
        { scope: "selfie", value: selfieAssessment },
      ];
      if (authorityAssessment) {
        assessments.push({ scope: "authority_document", value: authorityAssessment });
      }

      const counts: Record<AiDocAuthStatus, number> = {
        pass: 0,
        review: 0,
        fail: 0,
      };

      for (const assessment of assessments) {
        counts[assessment.value.aiAuthStatus] += 1;
      }

      const overallStatus: AiDocAuthStatus = counts.fail > 0 ? "fail" : counts.review > 0 ? "review" : "pass";
      const avgConfidence =
        assessments.reduce((sum, item) => sum + item.value.aiConfidence, 0) / Math.max(1, assessments.length);
      const aiFlags = assessments.flatMap((item) => item.value.aiFlags.map((flag) => `${item.scope}:${flag}`));
      const reviewStatus = overallStatus === "pass" ? "approved" : overallStatus === "fail" ? "rejected" : "pending";
      const profileVerificationStatus =
        overallStatus === "pass" ? "verified" : overallStatus === "fail" ? "rejected" : "pending";

      const client = await pool.connect();
      try {
        await client.query("begin");

        let inserted: Record<string, unknown> | null = null;
        for (let attempt = 0; attempt < 5; attempt += 1) {
          const code = generatePlatformIdentityCode();
          const result = await client.query(
            `
            insert into profile_identity_verifications (
              user_id,
              platform_identity_code,
              id_file_key,
              selfie_file_key,
              authority_document_file_key,
              provider,
              status,
              ai_auth_status,
              ai_confidence,
              ai_flags,
              rejection_reason,
              reviewed_at
            )
            values ($1,$2,$3,$4,$5,'pasalo_internal',$6,$7,$8,$9,$10,$11)
            on conflict (platform_identity_code) do nothing
            returning
              id,
              user_id,
              platform_identity_code,
              provider,
              status,
              ai_auth_status,
              ai_confidence,
              ai_flags,
              created_at,
              updated_at
          `,
            [
              request.user.sub,
              code,
              body.idFileKey,
              body.selfieFileKey,
              body.authorityDocumentFileKey ?? null,
              reviewStatus,
              overallStatus,
              Number(avgConfidence.toFixed(4)),
              aiFlags,
              reviewStatus === "rejected" ? "Automatic checks failed. Please re-upload clearer documents." : null,
              reviewStatus === "approved" || reviewStatus === "rejected" ? new Date() : null,
            ],
          );

          if (result.rowCount) {
            inserted = result.rows[0];
            break;
          }
        }

        if (!inserted) {
          throw fastify.httpErrors.internalServerError("Could not generate a unique Pasalo identity code");
        }

        await client.query(
          `
          update profiles
          set
            verification_status = $2::verification_status,
            verification_badge_shown = $3,
            updated_at = now()
          where user_id = $1
        `,
          [request.user.sub, profileVerificationStatus, overallStatus === "pass"],
        );

        await client.query("commit");

        return reply.code(201).send({
          item: inserted,
          summary: {
            overallStatus,
            passed: counts.pass,
            needsReview: counts.review,
            failed: counts.fail,
          },
        });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
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

      const inserted = await upsertVerificationDocument(pool, {
        listingId: body.listingId,
        userId: request.user.sub,
        docType: body.docType,
        fileKey: body.fileKey,
      });

      await pool.query(
        `
          update profiles
          set verification_status = case when verification_status = 'verified' then verification_status else 'pending' end,
              updated_at = now()
          where user_id = $1
        `,
        [request.user.sub],
      );

      return reply.code(201).send(inserted);
    },
  );

  fastify.post(
    "/me/verification-docs/ai-batch",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = verificationBatchSchema.parse(request.body);

      const listingResult = await pool.query("select id, owner_user_id from listings where id = $1", [body.listingId]);
      if (!listingResult.rowCount) {
        throw fastify.httpErrors.notFound("Listing not found");
      }

      const listing = listingResult.rows[0];
      const isOwner = listing.owner_user_id === request.user.sub;
      if (!isOwner && request.user.role !== "admin") {
        throw fastify.httpErrors.forbidden("You can only submit docs for your own listing");
      }

      const client = await pool.connect();
      try {
        await client.query("begin");

        const items: Record<string, unknown>[] = [];
        items.push(
          await upsertVerificationDocument(client, {
            listingId: body.listingId,
            userId: request.user.sub,
            docType: "id",
            fileKey: body.idFileKey,
          }),
        );
        items.push(
          await upsertVerificationDocument(client, {
            listingId: body.listingId,
            userId: request.user.sub,
            docType: "transfer_document",
            fileKey: body.transferDocumentFileKey,
          }),
        );
        items.push(
          await upsertVerificationDocument(client, {
            listingId: body.listingId,
            userId: request.user.sub,
            docType: "title_or_tax_declaration",
            fileKey: body.titleDeclarationFileKey,
          }),
        );
        items.push(
          await upsertVerificationDocument(client, {
            listingId: body.listingId,
            userId: request.user.sub,
            docType: "authority_document",
            fileKey: body.authorityDocumentFileKey,
          }),
        );

        await client.query(
          `
            update profiles
            set verification_status = case when verification_status = 'verified' then verification_status else 'pending' end,
                updated_at = now()
            where user_id = $1
          `,
          [request.user.sub],
        );

        await client.query("commit");

        const counts: Record<AiDocAuthStatus, number> = {
          pass: 0,
          review: 0,
          fail: 0,
        };

        for (const item of items) {
          const aiStatus = String(item.ai_auth_status) as AiDocAuthStatus;
          if (aiStatus in counts) {
            counts[aiStatus] += 1;
          }
        }

        const overallStatus: AiDocAuthStatus = counts.fail > 0 ? "fail" : counts.review > 0 ? "review" : "pass";

        return reply.code(201).send({
          items,
          summary: {
            overallStatus,
            passed: counts.pass,
            needsReview: counts.review,
            failed: counts.fail,
          },
        });
      } catch (error) {
        await client.query("rollback");
        throw error;
      } finally {
        client.release();
      }
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

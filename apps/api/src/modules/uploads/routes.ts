import { FastifyPluginAsync } from "fastify";
import { z } from "zod";
import { estimateDataUrlBytes, uploadDataUrlAsset, type UploadKind } from "../../lib/storage";

const uploadSchema = z.object({
  kind: z.enum([
    "listing_photo",
    "listing_verification",
    "identity_id",
    "identity_selfie",
    "identity_authority",
  ]),
  fileName: z.string().min(1).max(180),
  dataUrl: z.string().min(50),
});

const uploadLimitsBytes: Record<UploadKind, number> = {
  listing_photo: 5 * 1024 * 1024,
  listing_verification: 15 * 1024 * 1024,
  identity_id: 10 * 1024 * 1024,
  identity_selfie: 10 * 1024 * 1024,
  identity_authority: 10 * 1024 * 1024,
};

export const uploadRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post(
    "/uploads",
    {
      preHandler: [fastify.authenticate],
    },
    async (request, reply) => {
      const body = uploadSchema.parse(request.body);
      const sizeBytes = estimateDataUrlBytes(body.dataUrl.trim());

      if (sizeBytes === null) {
        throw fastify.httpErrors.badRequest("Invalid data URL upload payload.");
      }

      const limitBytes = uploadLimitsBytes[body.kind];
      if (sizeBytes > limitBytes) {
        const limitMb = Number((limitBytes / (1024 * 1024)).toFixed(0));
        throw fastify.httpErrors.badRequest(`File exceeds the ${limitMb}MB upload limit for ${body.kind}.`);
      }

      const uploaded = await uploadDataUrlAsset({
        kind: body.kind,
        dataUrl: body.dataUrl.trim(),
        fileName: body.fileName,
        userId: request.user.sub,
      });

      return reply.code(201).send(uploaded);
    },
  );
};

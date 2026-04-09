import { randomUUID } from "node:crypto";
import { extname } from "node:path";
import { env } from "../config/env";

export type UploadKind =
  | "listing_photo"
  | "listing_verification"
  | "identity_id"
  | "identity_selfie"
  | "identity_authority";

type UploadInput = {
  kind: UploadKind;
  fileName?: string | null;
  contentType: string;
  bytes: Uint8Array;
  userId?: string | null;
  localFallbackDataUrl?: string | null;
};

export type UploadedAsset = {
  provider: "local" | "supabase";
  storageKey: string;
  path: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
};

export function isSupabaseStorageEnabled(): boolean {
  return env.STORAGE_PROVIDER === "supabase";
}

export function estimateDataUrlBytes(value: string): number | null {
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
}

export function parseDataUrl(value: string): { contentType: string; bytes: Uint8Array } {
  if (!value.startsWith("data:")) {
    throw new Error("File must be provided as a data URL.");
  }

  const commaIndex = value.indexOf(",");
  if (commaIndex < 0) {
    throw new Error("Invalid data URL format.");
  }

  const header = value.slice(5, commaIndex);
  const payload = value.slice(commaIndex + 1);
  const [contentTypeSection] = header.split(";");
  const contentType = contentTypeSection?.trim() || "application/octet-stream";
  const isBase64 = header.includes(";base64");

  const bytes = isBase64
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "utf8");

  return {
    contentType,
    bytes,
  };
}

function sanitizeFileName(value: string | null | undefined, contentType: string): string {
  const incoming = value?.trim() || `upload-${Date.now()}`;
  const extension = extname(incoming).trim().toLowerCase();
  const normalizedBase = incoming
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 90) || "upload";

  const inferredExtension = extension || inferExtensionFromContentType(contentType);
  return `${normalizedBase}${inferredExtension}`;
}

function inferExtensionFromContentType(contentType: string): string {
  const normalized = contentType.toLowerCase();
  if (normalized === "image/jpeg") return ".jpg";
  if (normalized === "image/png") return ".png";
  if (normalized === "image/webp") return ".webp";
  if (normalized === "application/pdf") return ".pdf";
  return ".bin";
}

function getUploadFolder(kind: UploadKind): string {
  switch (kind) {
    case "listing_photo":
      return "listing-photos";
    case "listing_verification":
      return "listing-verifications";
    case "identity_id":
      return "identity-id";
    case "identity_selfie":
      return "identity-selfie";
    case "identity_authority":
      return "identity-authority";
  }
}

function buildObjectPath(kind: UploadKind, fileName: string, userId?: string | null): string {
  const prefix = userId ? `users/${userId}` : "public";
  const datePrefix = new Date().toISOString().slice(0, 10);
  return `${prefix}/${getUploadFolder(kind)}/${datePrefix}/${randomUUID()}-${fileName}`;
}

async function uploadToSupabase(input: UploadInput, fileName: string, path: string): Promise<UploadedAsset> {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Supabase storage is enabled but SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.");
  }

  const baseUrl = env.SUPABASE_URL.replace(/\/$/, "");
  const bucket = env.SUPABASE_STORAGE_BUCKET;
  const objectPath = encodeURI(path).replace(/%2F/g, "/");
  const response = await fetch(`${baseUrl}/storage/v1/object/${bucket}/${objectPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: env.SUPABASE_SERVICE_ROLE_KEY,
      "Content-Type": input.contentType,
      "x-upsert": "false",
    },
    body: Buffer.from(input.bytes),
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string; message?: string }
      | null;
    throw new Error(payload?.message || payload?.error || "Supabase upload failed.");
  }

  return {
    provider: "supabase",
    storageKey: `${baseUrl}/storage/v1/object/public/${bucket}/${objectPath}`,
    path,
    fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
  };
}

function uploadToLocalFallback(input: UploadInput, fileName: string, path: string): UploadedAsset {
  const isListingPhoto = input.kind === "listing_photo";
  const storageKey =
    isListingPhoto && input.localFallbackDataUrl
      ? input.localFallbackDataUrl
      : `https://uploads.pasalo.local/${encodeURI(path).replace(/%2F/g, "/")}`;

  return {
    provider: "local",
    storageKey,
    path,
    fileName,
    contentType: input.contentType,
    sizeBytes: input.bytes.byteLength,
  };
}

export async function uploadAsset(input: UploadInput): Promise<UploadedAsset> {
  const fileName = sanitizeFileName(input.fileName, input.contentType);
  const path = buildObjectPath(input.kind, fileName, input.userId);

  if (isSupabaseStorageEnabled()) {
    return uploadToSupabase(input, fileName, path);
  }

  return uploadToLocalFallback(input, fileName, path);
}

export async function uploadDataUrlAsset(input: {
  kind: UploadKind;
  dataUrl: string;
  fileName?: string | null;
  userId?: string | null;
}): Promise<UploadedAsset> {
  const parsed = parseDataUrl(input.dataUrl);
  return uploadAsset({
    kind: input.kind,
    fileName: input.fileName,
    contentType: parsed.contentType,
    bytes: parsed.bytes,
    userId: input.userId,
    localFallbackDataUrl: input.dataUrl,
  });
}

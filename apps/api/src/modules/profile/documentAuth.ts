export const verificationDocTypes = [
  "reservation_agreement",
  "soa",
  "id",
  "government_clearance_optional",
  "transfer_document",
  "title_or_tax_declaration",
  "authority_document",
] as const;

export type VerificationDocType = (typeof verificationDocTypes)[number];
export type AiDocAuthStatus = "pass" | "review" | "fail";

const expectedDocTokens: Record<VerificationDocType, string[]> = {
  id: ["id", "passport", "umid", "drivers_license", "philhealth", "sss"],
  transfer_document: ["deed", "transfer", "assignment", "contract_to_sell", "cts"],
  title_or_tax_declaration: ["title", "tct", "oct", "cct", "tax_declaration", "taxdec"],
  authority_document: ["spa", "special_power_of_attorney", "board_resolution", "secretary_certificate", "authorization"],
  reservation_agreement: ["reservation", "agreement", "resv"],
  soa: ["soa", "statement_of_account", "ledger", "amortization"],
  government_clearance_optional: ["clearance", "bir", "government"],
};

const suspiciousDocTokens = ["sample", "template", "dummy", "test", "blur", "invalid", "fake"];
const allowedDocExtensions = [".pdf", ".png", ".jpg", ".jpeg", ".webp"];
const selfieTokens = ["selfie", "face", "portrait", "front"];

export type AiDocAssessment = {
  aiAuthStatus: AiDocAuthStatus;
  aiConfidence: number;
  aiFlags: string[];
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function assessDocumentAuthenticity(docType: VerificationDocType, fileKey: string): AiDocAssessment {
  const normalized = fileKey.trim().toLowerCase();
  const tokens = expectedDocTokens[docType] ?? [];
  const matchedTokenCount = tokens.reduce((count, token) => (normalized.includes(token) ? count + 1 : count), 0);
  const suspiciousMatches = suspiciousDocTokens.filter((token) => normalized.includes(token));
  const hasAllowedExtension = allowedDocExtensions.some((ext) => normalized.includes(ext));
  const hasHttpPrefix = normalized.startsWith("http://") || normalized.startsWith("https://");

  let confidence = 0.34;
  confidence += Math.min(matchedTokenCount, 3) * 0.19;
  confidence += hasAllowedExtension ? 0.08 : -0.1;
  confidence += hasHttpPrefix ? 0.05 : 0;
  confidence += normalized.length >= 18 ? 0.06 : -0.04;
  confidence -= Math.min(0.48, suspiciousMatches.length * 0.24);
  confidence = clamp(confidence, 0.01, 0.99);

  const aiFlags: string[] = [];
  if (matchedTokenCount === 0) {
    aiFlags.push("missing_expected_keywords");
  }
  if (!hasAllowedExtension) {
    aiFlags.push("unsupported_file_extension");
  }
  if (!hasHttpPrefix) {
    aiFlags.push("non_http_storage_key");
  }
  if (suspiciousMatches.length) {
    aiFlags.push(`suspicious_keywords:${suspiciousMatches.join(",")}`);
  }

  const aiAuthStatus: AiDocAuthStatus =
    confidence >= 0.8 && suspiciousMatches.length === 0 ? "pass" : confidence >= 0.55 ? "review" : "fail";

  return {
    aiAuthStatus,
    aiConfidence: Number(confidence.toFixed(4)),
    aiFlags,
  };
}

export function assessSelfieAuthenticity(fileKey: string): AiDocAssessment {
  const normalized = fileKey.trim().toLowerCase();
  const matchedSelfieTokens = selfieTokens.filter((token) => normalized.includes(token));
  const suspiciousMatches = suspiciousDocTokens.filter((token) => normalized.includes(token));
  const hasAllowedExtension = allowedDocExtensions.some((ext) => normalized.includes(ext));
  const hasHttpPrefix = normalized.startsWith("http://") || normalized.startsWith("https://");

  let confidence = 0.36;
  confidence += Math.min(2, matchedSelfieTokens.length) * 0.2;
  confidence += hasAllowedExtension ? 0.1 : -0.12;
  confidence += hasHttpPrefix ? 0.05 : 0;
  confidence += normalized.length >= 18 ? 0.05 : -0.03;
  confidence -= Math.min(0.45, suspiciousMatches.length * 0.25);
  confidence = clamp(confidence, 0.01, 0.99);

  const aiFlags: string[] = [];
  if (!matchedSelfieTokens.length) {
    aiFlags.push("missing_selfie_keywords");
  }
  if (!hasAllowedExtension) {
    aiFlags.push("unsupported_file_extension");
  }
  if (!hasHttpPrefix) {
    aiFlags.push("non_http_storage_key");
  }
  if (suspiciousMatches.length) {
    aiFlags.push(`suspicious_keywords:${suspiciousMatches.join(",")}`);
  }

  const aiAuthStatus: AiDocAuthStatus =
    confidence >= 0.8 && suspiciousMatches.length === 0 ? "pass" : confidence >= 0.55 ? "review" : "fail";

  return {
    aiAuthStatus,
    aiConfidence: Number(confidence.toFixed(4)),
    aiFlags,
  };
}

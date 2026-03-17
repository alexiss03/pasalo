import test from "node:test";
import assert from "node:assert/strict";
import { assessDocumentAuthenticity } from "../dist/apps/api/src/modules/profile/documentAuth.js";

test("assessDocumentAuthenticity returns PASS for high-confidence ID docs", () => {
  const result = assessDocumentAuthenticity("id", "https://cdn.example.com/docs/seller-passport-id.jpg");
  assert.equal(result.aiAuthStatus, "pass");
  assert.ok(result.aiConfidence >= 0.8);
  assert.deepEqual(result.aiFlags, []);
});

test("assessDocumentAuthenticity returns REVIEW for moderate-confidence transfer docs", () => {
  const result = assessDocumentAuthenticity("transfer_document", "https://files.example.com/contract_to_sell.pdf");
  assert.equal(result.aiAuthStatus, "review");
  assert.ok(result.aiConfidence >= 0.55);
  assert.ok(result.aiConfidence < 0.8);
});

test("assessDocumentAuthenticity returns FAIL and flags suspicious uploads", () => {
  const result = assessDocumentAuthenticity("authority_document", "fake-template.txt");
  assert.equal(result.aiAuthStatus, "fail");
  assert.ok(result.aiConfidence < 0.55);
  assert.ok(result.aiFlags.includes("missing_expected_keywords"));
  assert.ok(result.aiFlags.includes("unsupported_file_extension"));
  assert.ok(result.aiFlags.some((flag) => flag.startsWith("suspicious_keywords:")));
});

test("assessDocumentAuthenticity flags non-http storage keys", () => {
  const result = assessDocumentAuthenticity("title_or_tax_declaration", "tct_document.pdf");
  assert.ok(result.aiFlags.includes("non_http_storage_key"));
});

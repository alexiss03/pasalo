import test from "node:test";
import assert from "node:assert/strict";
import { detectPaymentRelatedContent, PAYMENT_BLOCK_MESSAGE } from "../dist/contentPolicy.js";

test("detectPaymentRelatedContent does not block non-payment chat", () => {
  const result = detectPaymentRelatedContent("Can we schedule viewing this Saturday?");
  assert.equal(result.blocked, false);
  assert.deepEqual(result.labels, []);
});

test("detectPaymentRelatedContent blocks common payment wording", () => {
  const result = detectPaymentRelatedContent("How much cash out and down payment is needed?");
  assert.equal(result.blocked, true);
  assert.ok(result.labels.includes("cash"));
  assert.ok(result.labels.includes("deposit"));
});

test("detectPaymentRelatedContent blocks direct outside-app payment attempts", () => {
  const result = detectPaymentRelatedContent("Let's do direct payment outside platform via bank transfer.");
  assert.equal(result.blocked, true);
  assert.ok(result.labels.includes("offline"));
  assert.ok(result.labels.includes("bank"));
  assert.ok(result.labels.includes("transfer"));
});

test("PAYMENT_BLOCK_MESSAGE remains user-facing and explicit", () => {
  assert.match(PAYMENT_BLOCK_MESSAGE, /blocked/i);
  assert.match(PAYMENT_BLOCK_MESSAGE, /in-app payment/i);
});

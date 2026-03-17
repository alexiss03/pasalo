import test from "node:test";
import assert from "node:assert/strict";
import { computeListingFinancials, validateListingFinancials } from "../dist/finance.js";

const validInput = {
  originalPricePhp: 3000000,
  equityPaidPhp: 350000,
  remainingBalancePhp: 2650000,
  monthlyAmortizationPhp: 18000,
  cashOutPricePhp: 250000,
  remainingAmortizationMonths: 180,
  availableInPagIbig: true,
  availableInHouseLoan: false,
};

test("computeListingFinancials returns cash out + remaining balance", () => {
  const result = computeListingFinancials(validInput);
  assert.equal(result.estimatedTotalCostPhp, 2900000);
});

test("validateListingFinancials returns no errors for a valid payload", () => {
  const errors = validateListingFinancials(validInput);
  assert.deepEqual(errors, []);
});

test("validateListingFinancials reports negative numeric fields", () => {
  const errors = validateListingFinancials({
    ...validInput,
    cashOutPricePhp: -10,
    monthlyAmortizationPhp: -1,
  });

  assert.ok(errors.includes("cashOutPricePhp cannot be negative"));
  assert.ok(errors.includes("monthlyAmortizationPhp cannot be negative"));
});

test("validateListingFinancials enforces integer remaining amortization months", () => {
  const errors = validateListingFinancials({
    ...validInput,
    remainingAmortizationMonths: 12.5,
  });

  assert.ok(errors.includes("remainingAmortizationMonths must be a whole number"));
});

test("validateListingFinancials enforces remaining months when remaining balance exists", () => {
  const errors = validateListingFinancials({
    ...validInput,
    remainingBalancePhp: 100000,
    remainingAmortizationMonths: 0,
    originalPricePhp: 450000,
    equityPaidPhp: 350000,
  });

  assert.ok(
    errors.includes("remainingAmortizationMonths must be at least 1 when remainingBalancePhp is greater than 0"),
  );
});

test("validateListingFinancials enforces original = equity + remaining", () => {
  const errors = validateListingFinancials({
    ...validInput,
    originalPricePhp: 2990000,
  });

  assert.ok(errors.includes("originalPricePhp must equal equityPaidPhp + remainingBalancePhp"));
});

import { ListingFinancialComputed, ListingFinancialInput } from "./types";

export function computeListingFinancials(input: ListingFinancialInput): ListingFinancialComputed {
  const estimatedTotalCostPhp =
    input.cashOutPricePhp + input.remainingBalancePhp;

  return {
    estimatedTotalCostPhp,
  };
}

export function validateListingFinancials(input: ListingFinancialInput): string[] {
  const errors: string[] = [];
  const numericFields: Array<[keyof ListingFinancialInput, number]> = [
    ["originalPricePhp", input.originalPricePhp],
    ["equityPaidPhp", input.equityPaidPhp],
    ["remainingBalancePhp", input.remainingBalancePhp],
    ["monthlyAmortizationPhp", input.monthlyAmortizationPhp],
    ["cashOutPricePhp", input.cashOutPricePhp],
    ["remainingAmortizationMonths", input.remainingAmortizationMonths],
  ];

  for (const [key, value] of numericFields) {
    if (value < 0) {
      errors.push(`${key} cannot be negative`);
    }
  }

  if (!Number.isInteger(input.remainingAmortizationMonths)) {
    errors.push("remainingAmortizationMonths must be a whole number");
  }

  if (input.remainingBalancePhp > 0 && input.remainingAmortizationMonths < 1) {
    errors.push("remainingAmortizationMonths must be at least 1 when remainingBalancePhp is greater than 0");
  }

  const expectedOriginal = input.equityPaidPhp + input.remainingBalancePhp;
  if (Math.abs(expectedOriginal - input.originalPricePhp) > 1) {
    errors.push("originalPricePhp must equal equityPaidPhp + remainingBalancePhp");
  }

  return errors;
}

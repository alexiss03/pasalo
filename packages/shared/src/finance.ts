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
  const keys = Object.entries(input) as Array<[keyof ListingFinancialInput, number]>;

  for (const [key, value] of keys) {
    if (value < 0) {
      errors.push(`${key} cannot be negative`);
    }
  }

  const expectedOriginal = input.equityPaidPhp + input.remainingBalancePhp;
  if (Math.abs(expectedOriginal - input.originalPricePhp) > 1) {
    errors.push("originalPricePhp must equal equityPaidPhp + remainingBalancePhp");
  }

  return errors;
}

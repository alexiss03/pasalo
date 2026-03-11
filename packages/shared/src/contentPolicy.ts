export const PAYMENT_RELATED_PATTERNS: Array<{ label: string; pattern: RegExp }> = [
  { label: "payment", pattern: /\bpay(?:ment|ing|able|ed)?\b/i },
  { label: "money", pattern: /\bmoney\b/i },
  { label: "cash", pattern: /\bcash(?:\s?out)?\b/i },
  { label: "deposit", pattern: /\bdeposit|down\s?payment|reservation\s?fee\b/i },
  { label: "transfer", pattern: /\btransfer|remit|wire\b/i },
  { label: "bank", pattern: /\bbank|account\s?(?:no|number)|swift|iban\b/i },
  { label: "wallet", pattern: /\bgcash|maya|paymaya|paypal|wise|qrph|qr\s?code\b/i },
  { label: "offline", pattern: /\boffline|outside\s+app|outside\s+platform|direct\s+payment\b/i },
];

export const PAYMENT_BLOCK_MESSAGE =
  "Payment-related chat is blocked. Use the in-app payment section for all payments.";

export function detectPaymentRelatedContent(text: string): { blocked: boolean; labels: string[] } {
  const labels = PAYMENT_RELATED_PATTERNS.filter((entry) => entry.pattern.test(text)).map((entry) => entry.label);
  return {
    blocked: labels.length > 0,
    labels,
  };
}

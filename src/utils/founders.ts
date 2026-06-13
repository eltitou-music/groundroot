/**
 * The €99 founders offer. The Stripe Payment Link comes from an env var so
 * the real link can drop in without a code change; the counter is a static,
 * believable number for the demo (no live wiring — honest enough, no guilt).
 */

export const FOUNDERS_PRICE_EUR = 99;
export const STANDARD_PRICE_EUR = 149;
export const FOUNDERS_TOTAL = 1000;
export const FOUNDERS_REMAINING = 871;

const PLACEHOLDER = "https://buy.stripe.com/test_founders_placeholder";

export function foundersStripeLink(): string {
  const env = (import.meta.env.VITE_STRIPE_FOUNDERS_LINK as string | undefined)?.trim();
  return env && env.length > 0 ? env : PLACEHOLDER;
}

/** True when only the placeholder is configured — UI can soften the CTA. */
export function isPlaceholderLink(): boolean {
  return foundersStripeLink() === PLACEHOLDER;
}

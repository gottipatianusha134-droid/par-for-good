/** Central product configuration. Change values here, not in components. */
export const SITE_NAME = "Par for Good";
export const CURRENCY = "INR";

/** Prices in paise. The Stripe Prices you create must match these. */
export const PRICES = { monthly: 49900, yearly: 499900 } as const;

export const MIN_CHARITY_PERCENT = 10;
export const MAX_CHARITY_PERCENT = 50;
/** Default share of each subscription that funds prizes (admin can override in `settings`). */
export const DEFAULT_POOL_PERCENT = 50;

export const stripePriceId = (plan: "monthly" | "yearly") =>
  plan === "yearly" ? process.env.STRIPE_PRICE_YEARLY! : process.env.STRIPE_PRICE_MONTHLY!;

export const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

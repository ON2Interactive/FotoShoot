export type BillingPlanKind = "subscription" | "top_up";

export type BillingPlan = {
  key: "starter" | "pro" | "studio" | "top_up_50" | "top_up_100";
  kind: BillingPlanKind;
  label: string;
  credits: number;
  interval: "month" | null;
  priceUsd: number | null;
  stripeProductId: string;
  stripePriceId: string;
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    key: "starter",
    kind: "subscription",
    label: "Starter",
    credits: 100,
    interval: "month",
    priceUsd: 14.99,
    stripeProductId: "prod_UAHKLSfSFKP1G7",
    stripePriceId: "price_1TBwlkAfolXcWvyzm9PJfstt",
  },
  {
    key: "pro",
    kind: "subscription",
    label: "Pro",
    credits: 300,
    interval: "month",
    priceUsd: 39.99,
    stripeProductId: "prod_UAHM97fu0JaDDy",
    stripePriceId: "price_1TBwnOAfolXcWvyzvRfKph47",
  },
  {
    key: "studio",
    kind: "subscription",
    label: "Studio",
    credits: 800,
    interval: "month",
    priceUsd: 89.99,
    stripeProductId: "prod_UAHOGQlYNhcU8h",
    stripePriceId: "price_1TBwpbAfolXcWvyzEIWWccpK",
  },
  {
    key: "top_up_50",
    kind: "top_up",
    label: "Top Up 50",
    credits: 50,
    interval: null,
    priceUsd: null,
    stripeProductId: "prod_UAHRwmg4p3Mj74",
    stripePriceId: "price_1TBwsIAfolXcWvyztINlcEbK",
  },
  {
    key: "top_up_100",
    kind: "top_up",
    label: "Top Up 100",
    credits: 100,
    interval: null,
    priceUsd: null,
    stripeProductId: "prod_UAHRiAm8aqdS4x",
    stripePriceId: "price_1TBwsyAfolXcWvyzfEhkLEal",
  },
];

export const SUBSCRIPTION_PLANS = BILLING_PLANS.filter((plan) => plan.kind === "subscription");
export const TOP_UP_PLANS = BILLING_PLANS.filter((plan) => plan.kind === "top_up");

import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { BILLING_PLANS } from "@/lib/billing/plans";
import { getCurrentUser } from "@/lib/auth/current-user";
import { type AppUserRecord, updateUserStripeCustomerId } from "@/lib/users";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));

async function ensureStripeCustomer(user: AppUserRecord) {
  if (user.stripe_customer_id) {
    return user.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: user.email,
    name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || user.email,
    metadata: {
      userId: user.id,
    },
  });

  await updateUserStripeCustomerId(user.id, customer.id);
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const planKey = String(body?.planKey || "");
    const plan = BILLING_PLANS.find((entry) => entry.key === planKey);

    if (!plan) {
      return NextResponse.json({ error: "Invalid billing plan." }, { status: 400 });
    }

    const customerId = await ensureStripeCustomer(current.user);
    const origin = request.nextUrl.origin;
    const session = await stripe.checkout.sessions.create({
      mode: plan.kind === "subscription" ? "subscription" : "payment",
      customer: customerId,
      line_items: [
        {
          price: plan.stripePriceId,
          quantity: 1,
        },
      ],
      success_url: `${origin}/dashboard?billing=success`,
      cancel_url: `${origin}/dashboard?billing=cancelled`,
      metadata: {
        userId: current.user.id,
        planKey: plan.key,
        planKind: plan.kind,
      },
      subscription_data:
        plan.kind === "subscription"
          ? {
              metadata: {
                userId: current.user.id,
                planKey: plan.key,
              },
            }
          : undefined,
      payment_intent_data:
        plan.kind === "top_up"
          ? {
              metadata: {
                userId: current.user.id,
                planKey: plan.key,
              },
            }
          : undefined,
      allow_promotion_codes: true,
    });

    return NextResponse.json({ checkoutUrl: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to start checkout." },
      { status: 500 },
    );
  }
}

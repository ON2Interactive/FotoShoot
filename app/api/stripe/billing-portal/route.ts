import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { updateUserStripeCustomerId } from "@/lib/users";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));

async function ensureStripeCustomerId(current: Awaited<ReturnType<typeof getCurrentUser>>) {
  if (!current) {
    return null;
  }

  if (current.user.stripe_customer_id) {
    return current.user.stripe_customer_id;
  }

  const customer = await stripe.customers.create({
    email: current.user.email,
    name: `${current.user.first_name || ""} ${current.user.last_name || ""}`.trim() || current.user.email,
    metadata: {
      userId: current.user.id,
    },
  });

  await updateUserStripeCustomerId(current.user.id, customer.id);
  return customer.id;
}

export async function POST(request: NextRequest) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const customerId = await ensureStripeCustomerId(current);
    if (!customerId) {
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${request.nextUrl.origin}/dashboard`,
    });

    return NextResponse.json({ portalUrl: session.url });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to open billing portal." },
      { status: 500 },
    );
  }
}

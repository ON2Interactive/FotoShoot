import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));

export async function POST(request: NextRequest) {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!current.user.stripe_customer_id) {
      return NextResponse.json({ error: "No billing account found." }, { status: 400 });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: current.user.stripe_customer_id,
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

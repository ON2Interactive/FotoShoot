import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendFotoShootBillingAdminEmail } from "@/lib/email";
import { BILLING_PLANS } from "@/lib/billing/plans";
import {
  addCreditsIfNotExists,
  getUserByEmail,
  getUserByStripeCustomerId,
  updateUserStripeCustomerId,
  updateUserSubscriptionState,
} from "@/lib/users";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));
const PLANS_BY_PRICE_ID = new Map(BILLING_PLANS.map((plan) => [plan.stripePriceId, plan]));

function formatEmail(value: unknown) {
  return String(value || "").trim().toLowerCase() || "—";
}

function formatStatus(value: unknown) {
  return String(value || "").trim().toLowerCase() || "—";
}

async function sendBillingNotification(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const mode = String(session.mode || "—");
      await sendFotoShootBillingAdminEmail({
        subject: "FotoShoot: Checkout completed",
        lines: [
          "A FotoShoot checkout completed.",
          `Email: ${formatEmail(session.customer_details?.email || session.customer_email)}`,
          `Mode: ${mode}`,
          `Amount total: ${session.amount_total ?? "—"}`,
          `Currency: ${String(session.currency || "").toUpperCase() || "—"}`,
          `Stripe event: ${event.id}`,
        ],
      });
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      await sendFotoShootBillingAdminEmail({
        subject: "FotoShoot: Subscription payment received",
        lines: [
          "A FotoShoot invoice payment succeeded.",
          `Email: ${formatEmail(invoice.customer_email)}`,
          `Amount paid: ${invoice.amount_paid ?? "—"}`,
          `Currency: ${String(invoice.currency || "").toUpperCase() || "—"}`,
          `Stripe event: ${event.id}`,
        ],
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      await sendFotoShootBillingAdminEmail({
        subject: "FotoShoot: Subscription payment failed",
        lines: [
          "A FotoShoot invoice payment failed.",
          `Email: ${formatEmail(invoice.customer_email)}`,
          `Amount due: ${invoice.amount_due ?? "—"}`,
          `Currency: ${String(invoice.currency || "").toUpperCase() || "—"}`,
          `Stripe event: ${event.id}`,
        ],
      });
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      await sendFotoShootBillingAdminEmail({
        subject: `FotoShoot: ${event.type}`,
        lines: [
          "A FotoShoot subscription event occurred.",
          `Customer: ${String(subscription.customer || "—")}`,
          `Status: ${formatStatus(subscription.status)}`,
          `Subscription: ${subscription.id}`,
          `Stripe event: ${event.id}`,
        ],
      });
      break;
    }
    default:
      break;
  }
}

async function findUserForStripeEvent({
  customerId,
  email,
}: {
  customerId?: string | null;
  email?: string | null;
}) {
  if (customerId) {
    const userByCustomer = await getUserByStripeCustomerId(customerId);
    if (userByCustomer) {
      return userByCustomer;
    }
  }

  if (email) {
    const userByEmail = await getUserByEmail(email);
    if (userByEmail) {
      if (customerId && !userByEmail.stripe_customer_id) {
        await updateUserStripeCustomerId(userByEmail.id, customerId);
      }
      return userByEmail;
    }
  }

  return null;
}

async function applyStripeBusinessState(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const email = String(session.customer_details?.email || session.customer_email || "").trim().toLowerCase() || null;
      const user = await findUserForStripeEvent({ customerId, email });
      if (!user) break;

      const planKey = String(session.metadata?.planKey || "");
      const plan = BILLING_PLANS.find((entry) => entry.key === planKey);
      if (!plan) break;

      if (plan.kind === "top_up") {
        await addCreditsIfNotExists({
          userId: user.id,
          credits: plan.credits,
          type: "top_up",
          reason: `${plan.label} checkout`,
          stripeEventId: event.id,
        });
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId = typeof subscription.customer === "string" ? subscription.customer : null;
      const customerEmail =
        typeof subscription.customer === "string"
          ? ((await stripe.customers.retrieve(subscription.customer)) as Stripe.Customer).email
          : null;
      const user = await findUserForStripeEvent({ customerId, email: customerEmail });
      if (!user) break;

      const priceId = subscription.items.data[0]?.price?.id || "";
      const plan = PLANS_BY_PRICE_ID.get(priceId);
      await updateUserSubscriptionState(user.id, {
        stripe_customer_id: customerId,
        subscription_plan: event.type === "customer.subscription.deleted" ? null : plan?.key || user.subscription_plan,
        subscription_status: event.type === "customer.subscription.deleted" ? "canceled" : subscription.status,
      });
      break;
    }
    case "invoice.payment_succeeded": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const email = String(invoice.customer_email || "").trim().toLowerCase() || null;
      const user = await findUserForStripeEvent({ customerId, email });
      if (!user) break;

      const priceId = (((invoice.lines.data[0] as { pricing?: { price_details?: { price?: string } } } | undefined)?.pricing)
        ?.price_details?.price || "") as string;
      const plan = PLANS_BY_PRICE_ID.get(priceId);
      if (!plan || plan.kind !== "subscription") break;

      await addCreditsIfNotExists({
        userId: user.id,
        credits: plan.credits,
        type: "subscription_grant",
        reason: `${plan.label} monthly credits`,
        stripeEventId: event.id,
      });
      await updateUserSubscriptionState(user.id, {
        stripe_customer_id: customerId,
        subscription_plan: plan.key,
        subscription_status: "active",
      });
      break;
    }
    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      const email = String(invoice.customer_email || "").trim().toLowerCase() || null;
      const user = await findUserForStripeEvent({ customerId, email });
      if (!user) break;

      await updateUserSubscriptionState(user.id, {
        stripe_customer_id: customerId,
        subscription_status: "past_due",
      });
      break;
    }
    default:
      break;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, getRequiredEnv("STRIPE_WEBHOOK_SECRET"));
    await applyStripeBusinessState(event);
    await sendBillingNotification(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

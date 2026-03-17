import Stripe from "stripe";
import { NextRequest, NextResponse } from "next/server";
import { sendFotoShootBillingAdminEmail } from "@/lib/email";

function getRequiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

const stripe = new Stripe(getRequiredEnv("STRIPE_SECRET_KEY"));

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

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (!signature) {
      return NextResponse.json({ error: "Missing stripe-signature header." }, { status: 400 });
    }

    const event = stripe.webhooks.constructEvent(body, signature, getRequiredEnv("STRIPE_WEBHOOK_SECRET"));
    await sendBillingNotification(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook handler failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

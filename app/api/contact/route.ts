import { NextRequest, NextResponse } from "next/server";
import { sendFotoShootContactEmail } from "@/lib/email";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim().toLowerCase());
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const name = String(body?.name || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const subject = String(body?.subject || "").trim();
    const message = String(body?.message || "").trim();
    const company = String(body?.company || "").trim();
    const recaptchaToken = String(body?.recaptchaToken || "").trim();

    if (company) {
      return NextResponse.json({ ok: true });
    }

    if (!name || !email || !subject || !message) {
      return NextResponse.json({ error: "Name, email, subject, and message are required." }, { status: 400 });
    }

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: "A valid email address is required." }, { status: 400 });
    }

    const recaptchaResult = await verifyRecaptchaToken({
      token: recaptchaToken,
      expectedAction: "contact_submit",
      minScore: 0.5,
    });

    if (!recaptchaResult.ok) {
      return NextResponse.json(
        { error: "Security verification failed. Please refresh and try again." },
        { status: 400 },
      );
    }

    const result = await sendFotoShootContactEmail({
      name,
      email,
      subject,
      message,
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.reason || "Unable to send your message right now." }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Unexpected error while sending message." }, { status: 500 });
  }
}

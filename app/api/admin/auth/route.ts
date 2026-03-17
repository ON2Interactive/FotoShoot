import { NextRequest, NextResponse } from "next/server";
import { isValidAdminLogin, setAdminSessionCookie } from "@/app/api/admin/_utils";
import { verifyRecaptchaToken } from "@/lib/recaptcha";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "");
    const password = String(body?.password || "");
    const recaptchaToken = String(body?.recaptchaToken || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
    }

    const recaptchaResult = await verifyRecaptchaToken({
      token: recaptchaToken,
      expectedAction: "admin_login",
      minScore: 0.5,
    });

    if (!recaptchaResult.ok) {
      return NextResponse.json({ error: "Security verification failed." }, { status: 400 });
    }

    if (!isValidAdminLogin(email, password)) {
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    await setAdminSessionCookie();
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unexpected admin login error." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { isValidAdminLogin, setAdminSessionCookie } from "@/app/api/admin/_utils";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const email = String(body?.email || "");
    const password = String(body?.password || "");

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
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

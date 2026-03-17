import { NextResponse } from "next/server";
import { clearAuthSession } from "@/lib/auth/session";

export async function POST(request: Request) {
  await clearAuthSession();
  return NextResponse.json({ ok: true, redirectTo: new URL("/landing", request.url).toString() });
}

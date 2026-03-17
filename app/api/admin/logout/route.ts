import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/app/api/admin/_utils";

export async function POST() {
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { getGoogleOAuthUrl } from "@/lib/auth/google";
import { createOAuthState } from "@/lib/auth/session";

export async function GET() {
  const state = await createOAuthState();
  return NextResponse.redirect(getGoogleOAuthUrl(state));
}

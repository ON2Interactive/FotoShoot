import { NextRequest, NextResponse } from "next/server";
import { getRecaptchaSiteKey } from "@/lib/recaptcha";

export async function GET(request: NextRequest) {
  const action = String(request.nextUrl.searchParams.get("action") || "").trim() || "submit";
  return NextResponse.json({
    siteKey: getRecaptchaSiteKey(),
    action,
  });
}

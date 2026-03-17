import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/auth/google";
import { setAuthSession, validateOAuthState } from "@/lib/auth/session";
import { upsertUserFromGoogleProfile } from "@/lib/users";
import { sendFotoShootSignupNotificationEmail, sendFotoShootWelcomeEmail } from "@/lib/email";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code") || "";
  const state = request.nextUrl.searchParams.get("state") || "";
  const error = request.nextUrl.searchParams.get("error") || "";

  if (error) {
    return NextResponse.redirect(new URL("/signup?error=oauth_denied", request.url));
  }

  const isStateValid = await validateOAuthState(state);
  if (!isStateValid || !code) {
    return NextResponse.redirect(new URL("/signup?error=oauth_state", request.url));
  }

  try {
    const tokens = await exchangeGoogleCode(code);
    const user = await fetchGoogleUser(tokens.access_token);
    const syncResult = await upsertUserFromGoogleProfile(user);

    if (syncResult.isNewUser) {
      sendFotoShootWelcomeEmail({
        request,
        userEmail: user.email,
        userName: user.name,
      }).catch((error) => {
        console.error("Welcome email failed:", error?.message || error);
      });

      sendFotoShootSignupNotificationEmail({
        userEmail: user.email,
        userName: user.name,
      }).catch((error) => {
        console.error("Signup notification email failed:", error?.message || error);
      });
    }

    await setAuthSession({
      sub: user.sub,
      email: user.email,
      name: user.name,
      picture: user.picture,
    });

    return NextResponse.redirect(new URL("/dashboard", request.url));
  } catch {
    return NextResponse.redirect(new URL("/signup?error=oauth_callback", request.url));
  }
}

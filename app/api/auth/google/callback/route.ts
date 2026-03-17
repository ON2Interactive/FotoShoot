import { NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode, fetchGoogleUser } from "@/lib/auth/google";
import { setAuthSession, validateOAuthState } from "@/lib/auth/session";
import { upsertUserFromGoogleProfile, getUserByGoogleSub } from "@/lib/users";
import { sendFotoShootWelcomeEmail } from "@/lib/email";
import { ensureAdminSignupNotification } from "@/lib/signup-notifications";

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
      const persistedUser = await getUserByGoogleSub(user.sub);
      const emailResults = await Promise.allSettled([
        sendFotoShootWelcomeEmail({
          request,
          userEmail: user.email,
          userName: user.name,
        }),
        persistedUser
          ? ensureAdminSignupNotification({
              user: persistedUser,
              fallbackName: user.name,
            })
          : Promise.resolve({ ok: false, reason: "user_not_found_for_signup_notification" }),
      ]);

      emailResults.forEach((result, index) => {
        const label = index === 0 ? "Welcome email" : "Signup notification email";
        if (result.status === "rejected") {
          console.error(`${label} failed:`, result.reason);
          return;
        }

        if (!result.value?.ok) {
          const reason =
            "reason" in result.value && result.value.reason
              ? result.value.reason
              : "unknown_error";
          console.error(`${label} failed:`, reason);
        }
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

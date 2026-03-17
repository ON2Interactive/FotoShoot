import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";

export async function GET() {
  try {
    const current = await getCurrentUser();
    if (!current) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { user, session } = current;
    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ""} ${user.last_name || ""}`.trim() || session.name,
        firstName: user.first_name,
        lastName: user.last_name,
        avatarUrl: user.avatar_url || session.picture,
        creditsBalance: user.credits_balance,
        trialCreditsRemaining: user.trial_credits_remaining,
        trialClaimed: user.trial_claimed,
        subscriptionPlan: user.subscription_plan,
        subscriptionStatus: user.subscription_status,
        stripeCustomerId: user.stripe_customer_id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load account status." },
      { status: 500 },
    );
  }
}

import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { isInternalAdminEmail } from "@/lib/auth/admin-access";
import { getAuthSession } from "@/lib/auth/session";
import { getUserByGoogleSub } from "@/lib/users";
import { ensureAdminSignupNotification } from "@/lib/signup-notifications";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/signup");
  }

  const user = await getUserByGoogleSub(session.sub);

  if (user) {
    await ensureAdminSignupNotification({
      user,
      fallbackName: session.name,
    }).catch((error) => {
      console.error("Signup notification fallback failed:", error instanceof Error ? error.message : error);
    });
  }

  return (
    <DashboardShell
      initialAccount={{
        email: session.email,
        name: session.name,
        avatarUrl: session.picture,
        creditsBalance: user?.credits_balance ?? 0,
        trialCreditsRemaining: user?.trial_credits_remaining ?? 0,
        subscriptionPlan: user?.subscription_plan ?? null,
        subscriptionStatus: user?.subscription_status ?? null,
        stripeCustomerId: user?.stripe_customer_id ?? null,
        isInternalAdmin: isInternalAdminEmail(session.email),
      }}
    />
  );
}

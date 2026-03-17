import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { getAuthSession } from "@/lib/auth/session";
import { getUserByGoogleSub } from "@/lib/users";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/signup");
  }

  const user = await getUserByGoogleSub(session.sub);

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
      }}
    />
  );
}

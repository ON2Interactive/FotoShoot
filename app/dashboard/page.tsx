import { redirect } from "next/navigation";
import DashboardShell from "@/components/dashboard-shell";
import { getAuthSession } from "@/lib/auth/session";

export default async function DashboardPage() {
  const session = await getAuthSession();
  if (!session) {
    redirect("/signup");
  }

  return <DashboardShell />;
}

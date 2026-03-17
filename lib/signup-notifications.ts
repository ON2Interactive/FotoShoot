import { sendFotoShootSignupNotificationEmail } from "@/lib/email";
import { hasSignupNotificationBeenSent, markSignupNotificationSent, type AppUserRecord } from "@/lib/users";

export async function ensureAdminSignupNotification({
  user,
  fallbackName,
}: {
  user: AppUserRecord;
  fallbackName?: string | null;
}) {
  const alreadySent = await hasSignupNotificationBeenSent(user.id);
  if (alreadySent) {
    return { ok: true, skipped: true as const };
  }

  const userName =
    `${user.first_name || ""} ${user.last_name || ""}`.trim() ||
    String(fallbackName || "").trim() ||
    user.email;

  const result = await sendFotoShootSignupNotificationEmail({
    userEmail: user.email,
    userName,
  });

  if (!result.ok) {
    return result;
  }

  await markSignupNotificationSent(user.id);
  return { ok: true, skipped: false as const };
}

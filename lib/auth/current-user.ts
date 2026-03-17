import { getAuthSession } from "@/lib/auth/session";
import { isInternalAdminEmail } from "@/lib/auth/admin-access";
import { getUserByGoogleSub } from "@/lib/users";

export async function getCurrentUser() {
  const session = await getAuthSession();
  if (!session) {
    return null;
  }

  const user = await getUserByGoogleSub(session.sub);
  if (!user) {
    return null;
  }

  return {
    session,
    user,
    isInternalAdmin: isInternalAdminEmail(session.email),
  };
}

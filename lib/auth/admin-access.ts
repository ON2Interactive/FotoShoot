export function isInternalAdminEmail(email: string | null | undefined) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    return false;
  }

  const configuredEmails = String(process.env.ADMIN_FREE_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configuredEmails.includes(normalizedEmail);
}

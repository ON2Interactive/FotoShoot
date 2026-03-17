import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GoogleUser } from "@/lib/auth/google";

const DEFAULT_TRIAL_CREDITS = 20;

function splitName(fullName: string) {
  const trimmed = fullName.trim();
  if (!trimmed) {
    return { firstName: "", lastName: "" };
  }

  const parts = trimmed.split(/\s+/);
  return {
    firstName: parts[0] || "",
    lastName: parts.slice(1).join(" "),
  };
}

export async function upsertUserFromGoogleProfile(profile: GoogleUser) {
  const supabase = getSupabaseServerClient();
  const { firstName, lastName } = splitName(profile.name);

  const { data: existingUser, error: fetchError } = await supabase
    .from("users")
    .select("id, trial_claimed")
    .eq("google_sub", profile.sub)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (!existingUser) {
    const { data: insertedUser, error: insertError } = await supabase
      .from("users")
      .insert({
        google_sub: profile.sub,
        email: profile.email,
        first_name: firstName,
        last_name: lastName,
        avatar_url: profile.picture,
        credits_balance: DEFAULT_TRIAL_CREDITS,
        trial_credits_remaining: DEFAULT_TRIAL_CREDITS,
        trial_claimed: true,
      })
      .select("id")
      .single();

    if (insertError || !insertedUser) {
      throw new Error(insertError?.message || "Failed to create user.");
    }

    const { error: ledgerError } = await supabase.from("credit_ledger").insert({
      user_id: insertedUser.id,
      type: "trial_grant",
      credits: DEFAULT_TRIAL_CREDITS,
      reason: "Initial trial credits",
    });

    if (ledgerError) {
      throw new Error(ledgerError.message);
    }

    return {
      userId: insertedUser.id,
      isNewUser: true,
      firstName,
      lastName,
    };
  }

  const { error: updateError } = await supabase
    .from("users")
    .update({
      email: profile.email,
      first_name: firstName,
      last_name: lastName,
      avatar_url: profile.picture,
    })
    .eq("id", existingUser.id);

  if (updateError) {
    throw new Error(updateError.message);
  }

  return {
    userId: existingUser.id,
    isNewUser: false,
    firstName,
    lastName,
  };
}

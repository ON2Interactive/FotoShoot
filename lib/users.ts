import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { GoogleUser } from "@/lib/auth/google";

const DEFAULT_TRIAL_CREDITS = 20;

export type AppUserRecord = {
  id: string;
  google_sub: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  credits_balance: number;
  trial_credits_remaining: number;
  trial_claimed: boolean;
  subscription_plan: string | null;
  subscription_status: string | null;
  stripe_customer_id: string | null;
  created_at: string;
  updated_at: string;
};

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

export async function getUserByGoogleSub(googleSub: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").eq("google_sub", googleSub).maybeSingle<AppUserRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUserByEmail(email: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle<AppUserRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function getUserByStripeCustomerId(customerId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase.from("users").select("*").eq("stripe_customer_id", customerId).maybeSingle<AppUserRecord>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function updateUserStripeCustomerId(userId: string, stripeCustomerId: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("users").update({ stripe_customer_id: stripeCustomerId }).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function updateUserSubscriptionState(
  userId: string,
  values: {
    subscription_plan?: string | null;
    subscription_status?: string | null;
    stripe_customer_id?: string | null;
  },
) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("users").update(values).eq("id", userId);
  if (error) {
    throw new Error(error.message);
  }
}

export async function addCreditsIfNotExists({
  userId,
  credits,
  type,
  reason,
  stripeEventId,
}: {
  userId: string;
  credits: number;
  type: string;
  reason: string;
  stripeEventId: string;
}) {
  const supabase = getSupabaseServerClient();

  const { data: existingLedger, error: existingError } = await supabase
    .from("credit_ledger")
    .select("id")
    .eq("stripe_event_id", stripeEventId)
    .maybeSingle();

  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existingLedger) {
    return false;
  }

  const { data: user, error: userError } = await supabase.from("users").select("credits_balance").eq("id", userId).single();
  if (userError) {
    throw new Error(userError.message);
  }

  const nextCredits = Number(user.credits_balance || 0) + credits;
  const { error: updateError } = await supabase.from("users").update({ credits_balance: nextCredits }).eq("id", userId);
  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: ledgerError } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    type,
    credits,
    reason,
    stripe_event_id: stripeEventId,
  });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return true;
}

export async function consumeGenerationCredit({
  userId,
  reason,
}: {
  userId: string;
  reason: string;
}) {
  const supabase = getSupabaseServerClient();

  const { data: user, error: userError } = await supabase
    .from("users")
    .select("credits_balance, trial_credits_remaining")
    .eq("id", userId)
    .single();

  if (userError) {
    throw new Error(userError.message);
  }

  const currentBalance = Number(user.credits_balance || 0);
  if (currentBalance <= 0) {
    return { ok: false };
  }

  const nextTrialCredits = Math.max(0, Number(user.trial_credits_remaining || 0) - 1);
  const { error: updateError } = await supabase
    .from("users")
    .update({
      credits_balance: currentBalance - 1,
      trial_credits_remaining: nextTrialCredits,
    })
    .eq("id", userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: ledgerError } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    type: "generation_debit",
    credits: -1,
    reason,
  });

  if (ledgerError) {
    throw new Error(ledgerError.message);
  }

  return { ok: true };
}

export async function hasSignupNotificationBeenSent(userId: string) {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("type", "signup_notification")
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return Boolean(data);
}

export async function markSignupNotificationSent(userId: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("credit_ledger").insert({
    user_id: userId,
    type: "signup_notification",
    credits: 0,
    reason: "Admin signup notification sent",
  });

  if (error) {
    throw new Error(error.message);
  }
}

import { createHash, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const ADMIN_COOKIE_NAME = "fotoshoot_admin_session";
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

function getRequiredAdminEnv(name: "ADMIN_LOGIN_EMAIL" | "ADMIN_LOGIN_PASSWORD") {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}.`);
  }
  return value;
}

function hashToken(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function secureEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left, "utf8");
  const rightBuffer = Buffer.from(right, "utf8");

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function getAdminSessionValue() {
  const email = getRequiredAdminEnv("ADMIN_LOGIN_EMAIL").trim().toLowerCase();
  const password = getRequiredAdminEnv("ADMIN_LOGIN_PASSWORD");
  return hashToken(`${email}:${password}`);
}

export async function setAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ADMIN_COOKIE_NAME, getAdminSessionValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
  });
}

export async function clearAdminSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_COOKIE_NAME);
}

export async function hasValidAdminSession() {
  const cookieStore = await cookies();
  const stored = cookieStore.get(ADMIN_COOKIE_NAME)?.value || "";
  if (!stored) {
    return false;
  }
  return secureEqual(stored, getAdminSessionValue());
}

export async function assertAdminSession() {
  const isValid = await hasValidAdminSession();
  if (!isValid) {
    throw new Error("Unauthorized");
  }
}

export function isValidAdminLogin(email: string, password: string) {
  const expectedEmail = getRequiredAdminEnv("ADMIN_LOGIN_EMAIL").trim().toLowerCase();
  const expectedPassword = getRequiredAdminEnv("ADMIN_LOGIN_PASSWORD");

  return secureEqual(email.trim().toLowerCase(), expectedEmail) && secureEqual(password, expectedPassword);
}

export async function listAdminUsers() {
  const supabase = getSupabaseServerClient();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id,email,first_name,last_name,credits_balance,trial_credits_remaining,trial_claimed,subscription_plan,subscription_status,created_at,updated_at",
    )
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return data ?? [];
}

export async function updateAdminUser(id: string, updates: Record<string, unknown>) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("users").update(updates).eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteAdminUser(id: string) {
  const supabase = getSupabaseServerClient();
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) {
    throw new Error(error.message);
  }
}

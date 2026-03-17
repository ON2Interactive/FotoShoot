import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

export type AuthSession = {
  email: string;
  name: string;
  picture: string;
  sub: string;
};

const SESSION_COOKIE_NAME = "fotoshoot_session";
const OAUTH_STATE_COOKIE_NAME = "fotoshoot_oauth_state";
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;
const OAUTH_STATE_MAX_AGE = 60 * 10;

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("Missing SESSION_SECRET.");
  }
  return secret;
}

function toBase64Url(value: string) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function fromBase64Url(value: string) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value: string) {
  return createHmac("sha256", getSessionSecret()).update(value).digest("base64url");
}

export async function createOAuthState() {
  const state = randomBytes(24).toString("hex");
  const cookieStore = await cookies();
  cookieStore.set(OAUTH_STATE_COOKIE_NAME, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });
  return state;
}

export async function validateOAuthState(state: string) {
  const cookieStore = await cookies();
  const stored = cookieStore.get(OAUTH_STATE_COOKIE_NAME)?.value || "";
  cookieStore.delete(OAUTH_STATE_COOKIE_NAME);

  if (!stored || !state) {
    return false;
  }

  const left = Buffer.from(stored);
  const right = Buffer.from(state);
  if (left.length !== right.length) {
    return false;
  }

  return timingSafeEqual(left, right);
}

export async function setAuthSession(session: AuthSession) {
  const payload = toBase64Url(JSON.stringify(session));
  const signature = sign(payload);
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: true,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
}

export async function clearAuthSession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;
  if (!raw) {
    return null;
  }

  const [payload, signature] = raw.split(".");
  if (!payload || !signature) {
    return null;
  }

  const expected = sign(payload);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    return null;
  }

  try {
    return JSON.parse(fromBase64Url(payload)) as AuthSession;
  } catch {
    return null;
  }
}

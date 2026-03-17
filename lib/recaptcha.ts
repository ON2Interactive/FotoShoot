type VerifyRecaptchaOptions = {
  token: string;
  expectedAction: string;
  minScore?: number;
};

type VerifyRecaptchaResult = {
  ok: boolean;
  reason?: string;
  score?: number;
};

function getRecaptchaSecretKey() {
  return process.env.RECAPTCHA_SECRET_KEY || "";
}

export function getRecaptchaSiteKey() {
  return process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";
}

export async function verifyRecaptchaToken({
  token,
  expectedAction,
  minScore = 0.5,
}: VerifyRecaptchaOptions): Promise<VerifyRecaptchaResult> {
  const secret = getRecaptchaSecretKey();

  if (!secret) {
    return { ok: false, reason: "reCAPTCHA is not configured." };
  }

  if (!token) {
    return { ok: false, reason: "Missing reCAPTCHA token." };
  }

  const body = new URLSearchParams({
    secret,
    response: token,
  });

  const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: body.toString(),
    cache: "no-store",
  });

  const payload = (await response.json().catch(() => null)) as
    | {
        success?: boolean;
        action?: string;
        score?: number;
        ["error-codes"]?: string[];
      }
    | null;

  if (!response.ok || !payload?.success) {
    return {
      ok: false,
      reason: payload?.["error-codes"]?.join(", ") || "reCAPTCHA verification failed.",
    };
  }

  if (payload.action && payload.action !== expectedAction) {
    return { ok: false, reason: "reCAPTCHA action mismatch.", score: payload.score };
  }

  if (typeof payload.score === "number" && payload.score < minScore) {
    return { ok: false, reason: "reCAPTCHA score too low.", score: payload.score };
  }

  return {
    ok: true,
    score: payload.score,
  };
}

const escapeHtml = (value: string) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const normalizeEmail = (value: string) => String(value || "").trim().toLowerCase();

const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(value));

const getBaseUrlFromRequest = (request: Request) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

const getFromEmail = () => String(process.env.SENDGRID_FROM_EMAIL || "").trim();

const getDefaultNotifyEmail = () =>
  normalizeEmail(
    process.env.SIGNUP_NOTIFY_EMAIL ||
      process.env.BILLING_NOTIFY_EMAIL ||
      process.env.CONTACT_TO_EMAIL ||
      "hello@fotoshoot.cloud",
  );

export async function sendSendgridMail({
  toEmail,
  subject,
  textBody,
  htmlBody,
  replyTo = null,
}: {
  toEmail: string;
  subject: string;
  textBody: string;
  htmlBody: string;
  replyTo?: string | null;
}) {
  const apiKey = String(process.env.SENDGRID_API_KEY || "").trim();
  const fromEmail = getFromEmail();
  const normalizedTo = normalizeEmail(toEmail);

  if (!apiKey) {
    return { ok: false, reason: "sendgrid_api_key_missing" };
  }

  if (!fromEmail) {
    return { ok: false, reason: "sendgrid_from_email_missing" };
  }

  if (!isValidEmail(normalizedTo)) {
    return { ok: false, reason: "invalid_to_email" };
  }

  const payload: Record<string, unknown> = {
    personalizations: [
      {
        to: [{ email: normalizedTo }],
        subject: String(subject || "").trim() || "FotoShoot",
      },
    ],
    from: {
      email: fromEmail,
    },
    content: [
      {
        type: "text/plain",
        value: String(textBody || "").trim(),
      },
      {
        type: "text/html",
        value: String(htmlBody || "").trim(),
      },
    ],
  };

  const normalizedReplyTo = normalizeEmail(replyTo || "");
  if (isValidEmail(normalizedReplyTo)) {
    payload.reply_to = { email: normalizedReplyTo };
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (response.ok) {
    return { ok: true };
  }

  const data = await response.json().catch(() => ({}));
  const reason = Array.isArray(data?.errors)
    ? data.errors.map((entry: { message?: string }) => entry?.message).filter(Boolean).join(", ")
    : data?.message || data?.error || "sendgrid_request_failed";
  return { ok: false, reason };
}

export async function sendFotoShootWelcomeEmail({
  request,
  userEmail,
  userName,
}: {
  request: Request;
  userEmail: string;
  userName: string;
}) {
  const targetEmail = normalizeEmail(userEmail);
  if (!isValidEmail(targetEmail)) {
    return { ok: false, reason: "invalid_user_email" };
  }

  const safeName = String(userName || "").trim() || "there";
  const firstName = safeName.split(/\s+/)[0] || "there";
  const dashboardUrl = `${getBaseUrlFromRequest(request)}/dashboard`;
  const subject = "Welcome to FotoShoot";
  const textBody = [
    `Hi ${firstName},`,
    "",
    "Welcome to FotoShoot.",
    "",
    "Your workspace is ready.",
    "",
    "FotoShoot is designed to help you turn rough product photos into polished marketing assets faster. You can upload images, refine them with AI, and use your credits to explore new directions without setting up a full shoot.",
    "",
    "Here's what you can do right away:",
    "- Upload your first product photo",
    "- Explore edits and variations with AI",
    "- Build polished outputs for campaigns and ecommerce",
    "- Use your 20 trial credits to test the workspace",
    "",
    `Open your dashboard: ${dashboardUrl}`,
    "",
    "To get started:",
    "1. Upload a product image",
    "2. Try your first AI enhancement",
    "3. Generate a polished final asset",
    "",
    "We look forward to seeing what you create with FotoShoot.",
    "",
    "The FotoShoot Team",
  ].join("\n");

  const htmlBody = `
    <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;font-size:16px;">
      <p>Hi ${escapeHtml(firstName)},</p>
      <p>Welcome to FotoShoot.</p>
      <p>Your workspace is ready.</p>
      <p>FotoShoot is designed to help you turn rough product photos into polished marketing assets faster. You can upload images, refine them with AI, and use your credits to explore new directions without setting up a full shoot.</p>
      <p>Here’s what you can do right away:</p>
      <ul style="padding-left:20px;">
        <li>Upload your first product photo</li>
        <li>Explore edits and variations with AI</li>
        <li>Build polished outputs for campaigns and ecommerce</li>
        <li>Use your 20 trial credits to test the workspace</li>
      </ul>
      <div style="margin:30px 0;">
        <a href="${escapeHtml(dashboardUrl)}" style="background-color:#000;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;display:inline-block;">Open FotoShoot →</a>
      </div>
      <p>To get started:</p>
      <ol style="padding-left:20px;">
        <li>Upload a product image</li>
        <li>Try your first AI enhancement</li>
        <li>Generate a polished final asset</li>
      </ol>
      <p>We look forward to seeing what you create with FotoShoot.</p>
      <p>The FotoShoot Team</p>
    </div>
  `;

  return sendSendgridMail({
    toEmail: targetEmail,
    subject,
    textBody,
    htmlBody,
  });
}

export async function sendFotoShootSignupNotificationEmail({
  userEmail,
  userName,
}: {
  userEmail: string;
  userName: string;
}) {
  const notifyEmail = getDefaultNotifyEmail();
  if (!isValidEmail(notifyEmail)) {
    return { ok: false, reason: "invalid_notify_email" };
  }

  const safeName = String(userName || "").trim() || "—";
  const safeEmail = normalizeEmail(userEmail);
  const signedUpAt = new Date().toISOString();

  return sendSendgridMail({
    toEmail: notifyEmail,
    subject: "FotoShoot: New user signup",
    textBody: [
      "A new user signed up for FotoShoot.",
      "",
      `Name: ${safeName}`,
      `Email: ${safeEmail}`,
      `Signed up at: ${signedUpAt}`,
    ].join("\n"),
    htmlBody: `
      <p>A new user signed up for FotoShoot.</p>
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
      <p><strong>Signed up at:</strong> ${escapeHtml(signedUpAt)}</p>
    `,
  });
}

export async function sendFotoShootContactEmail({
  name,
  email,
  subject,
  message,
}: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  const notifyEmail = getDefaultNotifyEmail();
  if (!isValidEmail(notifyEmail)) {
    return { ok: false, reason: "invalid_notify_email" };
  }

  const safeName = String(name || "").trim() || "—";
  const safeEmail = normalizeEmail(email);
  const safeSubject = String(subject || "").trim() || "Contact form";
  const safeMessage = String(message || "").trim();

  return sendSendgridMail({
    toEmail: notifyEmail,
    subject: `FotoShoot contact: ${safeSubject}`,
    replyTo: safeEmail,
    textBody: [`Name: ${safeName}`, `Email: ${safeEmail}`, `Subject: ${safeSubject}`, "", safeMessage].join("\n"),
    htmlBody: `
      <p><strong>Name:</strong> ${escapeHtml(safeName)}</p>
      <p><strong>Email:</strong> ${escapeHtml(safeEmail)}</p>
      <p><strong>Subject:</strong> ${escapeHtml(safeSubject)}</p>
      <p><strong>Message:</strong></p>
      <p>${escapeHtml(safeMessage).replace(/\n/g, "<br />")}</p>
    `,
  });
}

export async function sendFotoShootBillingAdminEmail({
  subject,
  lines = [],
}: {
  subject: string;
  lines?: string[];
}) {
  const notifyEmail = getDefaultNotifyEmail();
  if (!isValidEmail(notifyEmail)) {
    return { ok: false, reason: "invalid_notify_email" };
  }

  const timestamp = new Date().toISOString();
  return sendSendgridMail({
    toEmail: notifyEmail,
    subject,
    textBody: [...lines, `Time: ${timestamp}`].join("\n"),
    htmlBody: `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;color:#333;line-height:1.6;font-size:16px;">
        ${lines.map((line) => `<p>${escapeHtml(line)}</p>`).join("")}
        <p><strong>Time:</strong> ${escapeHtml(timestamp)}</p>
      </div>
    `,
  });
}

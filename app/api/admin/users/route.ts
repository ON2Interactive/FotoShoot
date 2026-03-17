import { NextRequest, NextResponse } from "next/server";
import { assertAdminSession, deleteAdminUser, listAdminUsers, updateAdminUser } from "@/app/api/admin/_utils";

function toOptionalString(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = String(value).trim();
  return trimmed || null;
}

function toSafeInteger(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

export async function GET() {
  try {
    await assertAdminSession();
    const users = await listAdminUsers();
    return NextResponse.json({ users });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load users." },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 },
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await assertAdminSession();
    const body = await request.json();
    const id = String(body?.id || "");

    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    await updateAdminUser(id, {
      first_name: toOptionalString(body?.first_name),
      last_name: toOptionalString(body?.last_name),
      credits_balance: toSafeInteger(body?.credits_balance),
      trial_credits_remaining: toSafeInteger(body?.trial_credits_remaining),
      trial_claimed: Boolean(body?.trial_claimed),
      subscription_plan: toOptionalString(body?.subscription_plan),
      subscription_status: toOptionalString(body?.subscription_status),
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user." },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 },
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await assertAdminSession();
    const body = await request.json();
    const id = String(body?.id || "");

    if (!id) {
      return NextResponse.json({ error: "User id is required." }, { status: 400 });
    }

    await deleteAdminUser(id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to delete user." },
      { status: error instanceof Error && error.message === "Unauthorized" ? 401 : 500 },
    );
  }
}

import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  generateRecoveryCodes,
  hashRecoveryCode,
} from "@/lib/auth/mfa-recovery";
import { verifyMfaAal2IfEnrolled } from "@/lib/auth/admin-security";

async function getAuthenticatedUserWithMfa() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  if (!user) {
    return { errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  const mfaCheck = await verifyMfaAal2IfEnrolled(sessionClient);
  if (!mfaCheck.ok) {
    return {
      errorResponse: NextResponse.json(
        { error: "Verify your 6-digit 2FA code first." },
        { status: 403 },
      ),
    };
  }

  return { sessionClient, user };
}

export async function GET() {
  try {
    const ctx = await getAuthenticatedUserWithMfa();
    if ("errorResponse" in ctx) return ctx.errorResponse;

    const hashes = Array.isArray(ctx.user.app_metadata?.mfa_recovery_hashes)
      ? (ctx.user.app_metadata.mfa_recovery_hashes as string[])
      : [];

    return NextResponse.json(
      { remainingCount: hashes.length },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load recovery code status" },
      { status: 500 },
    );
  }
}

export async function POST() {
  try {
    const ctx = await getAuthenticatedUserWithMfa();
    if ("errorResponse" in ctx) return ctx.errorResponse;

    const { data: factorsData } = await ctx.sessionClient.auth.mfa.listFactors();
    const hasVerifiedTotp = Boolean(
      (factorsData?.totp ?? []).some((f) => f.status === "verified"),
    );

    if (!hasVerifiedTotp) {
      return NextResponse.json(
        { error: "Enable and verify an Authenticator app before generating backup codes." },
        { status: 400 },
      );
    }

    const codes = generateRecoveryCodes(8);
    const hashes = codes.map((c) => hashRecoveryCode(c));

    const serviceClient = getServiceRoleClient();
    const { data: freshData } = await serviceClient.auth.admin.getUserById(ctx.user.id);
    const currentAppMeta = (freshData?.user?.app_metadata ?? ctx.user.app_metadata ?? {}) as Record<
      string,
      unknown
    >;

    const { error: updateErr } = await serviceClient.auth.admin.updateUserById(
      ctx.user.id,
      {
        app_metadata: {
          ...currentAppMeta,
          mfa_recovery_hashes: hashes,
          mfa_recovery_generated_at: new Date().toISOString(),
        },
      },
    );

    if (updateErr) {
      return NextResponse.json({ error: updateErr.message }, { status: 400 });
    }

    return NextResponse.json(
      {
        success: true,
        codes,
        remainingCount: hashes.length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate backup codes" },
      { status: 500 },
    );
  }
}

export async function DELETE() {
  try {
    const ctx = await getAuthenticatedUserWithMfa();
    if ("errorResponse" in ctx) return ctx.errorResponse;

    const serviceClient = getServiceRoleClient();
    const { data: freshData } = await serviceClient.auth.admin.getUserById(ctx.user.id);
    const currentAppMeta = (freshData?.user?.app_metadata ?? ctx.user.app_metadata ?? {}) as Record<
      string,
      unknown
    >;

    await serviceClient.auth.admin.updateUserById(ctx.user.id, {
      app_metadata: {
        ...currentAppMeta,
        mfa_recovery_hashes: [],
      },
    });

    return NextResponse.json({ success: true, remainingCount: 0 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear backup codes" },
      { status: 500 },
    );
  }
}

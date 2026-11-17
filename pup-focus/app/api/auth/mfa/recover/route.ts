import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  findMatchingHashIndex,
  normalizeRecoveryCode,
} from "@/lib/auth/mfa-recovery";
import { logTransactionEvent } from "@/features/transaction-logs/services/transaction-log.service";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user || !user.email) {
      return NextResponse.json(
        { error: "Sign in with your email and password first before entering a backup code." },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const rawCode = typeof body.code === "string" ? body.code : "";
    const normalized = normalizeRecoveryCode(rawCode);

    if (normalized.length < 6) {
      return NextResponse.json(
        { error: "Enter a valid backup recovery code." },
        { status: 400 },
      );
    }

    const serviceClient = getServiceRoleClient();
    const { data: freshUserData, error: userFetchErr } =
      await serviceClient.auth.admin.getUserById(user.id);

    if (userFetchErr || !freshUserData?.user) {
      return NextResponse.json(
        { error: "Unable to verify recovery code for this account." },
        { status: 400 },
      );
    }

    const targetUser = freshUserData.user;
    const currentAppMeta = (targetUser.app_metadata ?? {}) as Record<
      string,
      unknown
    >;
    const storedHashes = Array.isArray(currentAppMeta.mfa_recovery_hashes)
      ? (currentAppMeta.mfa_recovery_hashes as string[])
      : [];

    if (storedHashes.length === 0) {
      return NextResponse.json(
        { error: "No backup recovery codes are configured for this account." },
        { status: 400 },
      );
    }

    const matchIdx = findMatchingHashIndex(normalized, storedHashes);
    if (matchIdx === -1) {
      return NextResponse.json(
        { error: "Invalid or already used backup recovery code." },
        { status: 400 },
      );
    }

    // Consume this single-use backup code immediately
    const remainingHashes = storedHashes.filter((_, idx) => idx !== matchIdx);
    const { error: updateErr } = await serviceClient.auth.admin.updateUserById(
      targetUser.id,
      {
        app_metadata: {
          ...currentAppMeta,
          mfa_recovery_hashes: remainingHashes,
          mfa_last_recovery_at: new Date().toISOString(),
        },
      },
    );

    if (updateErr) {
      return NextResponse.json(
        { error: "Failed to consume backup recovery code." },
        { status: 500 },
      );
    }

    // Remove enrolled MFA factors since the user lost access to their Authenticator App
    const { data: listData } = await serviceClient.auth.admin.mfa.listFactors({
      userId: targetUser.id,
    });
    for (const factor of listData?.factors ?? []) {
      await serviceClient.auth.admin.mfa
        .deleteFactor({ id: factor.id, userId: targetUser.id })
        .catch(() => null);
    }

    // Mint a fresh session after deleteFactor invalidates existing verified sessions
    let freshSession: any = null;
    let freshUser: any = null;
    try {
      const { data: linkData } = await serviceClient.auth.admin.generateLink({
        type: "magiclink",
        email: targetUser.email!,
      });
      const tokenHash = linkData?.properties?.hashed_token;
      if (tokenHash) {
        const { data: verifyData } = await sessionClient.auth.verifyOtp({
          token_hash: tokenHash,
          type: "magiclink",
        });
        freshSession = verifyData?.session ?? null;
        freshUser = verifyData?.user ?? null;
      }
    } catch {
      // Fallback handled below
    }

    void logTransactionEvent({
      actorId: targetUser.id,
      action: "auth.mfa_recovery_used",
      entityType: "user",
      entityId: targetUser.id,
      metadata: {
        email: targetUser.email,
        remainingBackupCodes: remainingHashes.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        remainingCount: remainingHashes.length,
        session: freshSession,
        user: freshUser ?? targetUser,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to verify backup recovery code.",
      },
      { status: 500 },
    );
  }
}

import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { verifyMfaAal2IfEnrolled } from "@/lib/auth/admin-security";

/**
 * Redirects back to Sign In for TOTP verification when the current session is
 * authenticated (`aal1`) on an account that already has TOTP 2FA enrolled (`aal2`).
 */
export async function enforceServerMfaIfEnrolled(): Promise<void> {
  const supabase = await createServerSupabaseClient();
  const status = await verifyMfaAal2IfEnrolled(supabase);
  if (!status.ok) {
    redirect("/?reason=mfa_required");
  }
}

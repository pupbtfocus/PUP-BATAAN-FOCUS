export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const email = (searchParams.get("email") || "").trim().toLowerCase();

    const supabase = getServiceRoleClient();

    if (!email) {
      // If email parameter wasn't preserved in URL, check if there was a recent cancelled invite
      const { data: recentCancelled } = await supabase
        .from("audit_logs")
        .select("id, created_at, metadata")
        .eq("action", "user.invite_cancelled")
        .order("created_at", { ascending: false })
        .limit(1);

      if (recentCancelled && recentCancelled.length > 0) {
        const latest = recentCancelled[0];
        const targetEmail = (latest.metadata?.target_email || "").trim().toLowerCase();
        const targetFullName = latest.metadata?.target_full_name || targetEmail.split("@")[0];
        return NextResponse.json({
          isCancelled: true,
          email: targetEmail,
          fullName: targetFullName,
          cancelledAt: latest.created_at,
        });
      }

      return NextResponse.json({ isCancelled: false });
    }

    // 1. Check if user still exists in auth.users
    const {
      data: { users },
    } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    const activeUser = users?.find(
      (u) => u.email?.trim().toLowerCase() === email
    );

    // If an active user exists and has confirmed, it was not cancelled
    if (activeUser && (activeUser.email_confirmed_at || activeUser.confirmed_at || activeUser.last_sign_in_at)) {
      return NextResponse.json({ isCancelled: false, isAccepted: true });
    }

    // 2. Check audit logs for user.invite_cancelled
    const { data: auditLogs } = await supabase
      .from("audit_logs")
      .select("id, created_at, metadata")
      .eq("action", "user.invite_cancelled")
      .order("created_at", { ascending: false })
      .limit(50);

    const cancelledLog = (auditLogs ?? []).find((log: any) => {
      const targetEmail = (
        log.metadata?.target_email ||
        log.metadata?.email ||
        ""
      ).toLowerCase();
      return targetEmail === email;
    });

    if (cancelledLog) {
      return NextResponse.json({
        isCancelled: true,
        cancelledAt: cancelledLog.created_at,
        email,
        fullName: cancelledLog.metadata?.target_full_name || email.split("@")[0],
      });
    }

    // If user does not exist in auth at all, but was checking an invite link
    if (!activeUser) {
      return NextResponse.json({
        isCancelled: true,
        reason: "User record not found / invite revoked",
        email,
        fullName: email.split("@")[0],
      });
    }

    return NextResponse.json({ isCancelled: false });
  } catch (error: any) {
    console.error("Error checking cancelled invite status:", error);
    return NextResponse.json({ isCancelled: false, error: error?.message });
  }
}

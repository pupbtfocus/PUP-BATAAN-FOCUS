import { NextResponse, type NextRequest } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import {
  evaluateSubmissionWindow,
  getSubmissionWindow,
  normalizeTime24Hour,
} from "@/features/submissions/services/submission-window.service";
import crypto from "crypto";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "Unauthorized - not authenticated" },
        { status: 401 },
      );
    }

    const body = await request.json().catch(() => ({}));
    const fileName = (body.fileName || "").trim();
    const requirementCode = (body.requirementCode || body.requirement_type || "").trim();
    const fileSize = Number(body.fileSize) || 0;

    if (!fileName || !requirementCode) {
      return NextResponse.json(
        { error: "File name and requirement code are required." },
        { status: 400 },
      );
    }

    const supabaseAdmin = getServiceRoleClient();

    // 1. Check requirement template visibility & max file size limit
    const { data: template } = await supabaseAdmin
      .from("requirement_templates")
      .select("max_size_mb, is_active")
      .ilike("code", requirementCode)
      .maybeSingle();

    if (template && !template.is_active) {
      return NextResponse.json(
        { error: "This requirement is currently inactive or hidden from submissions." },
        { status: 400 },
      );
    }

    const maxAllowedMb = template?.max_size_mb ? Number(template.max_size_mb) : 50;
    if (fileSize > 0 && fileSize > maxAllowedMb * 1024 * 1024) {
      return NextResponse.json(
        {
          error: `File size exceeds the configured maximum limit of ${maxAllowedMb} MB for this requirement template.`,
        },
        { status: 400 },
      );
    }

    // 2. Validate submission window & active extension grants
    const submissionWindow = await getSubmissionWindow(supabaseAdmin);
    const windowState = evaluateSubmissionWindow(submissionWindow);

    let isUnlockedViaExtension = false;
    let isExempted = false;
    let hasCustomDuePassed = false;

    try {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      const profileId = profile?.id || user.id;

      const { data: existingSub } = await supabaseAdmin
        .from("submissions")
        .select("status, due_at")
        .eq("requirement_code", requirementCode)
        .eq("faculty_profile_id", profileId)
        .maybeSingle();

      const existingStatus = (existingSub?.status || "").toLowerCase().trim();
      if (existingStatus === "exempted" || existingStatus === "exempt") {
        isExempted = true;
      }

      if (existingSub?.due_at) {
        const customIso = existingSub.due_at.includes("T")
          ? existingSub.due_at
          : `${existingSub.due_at}T23:59:59+08:00`;
        const customMs = new Date(customIso).getTime();
        if (!Number.isNaN(customMs)) {
          if (Date.now() <= customMs) {
            isUnlockedViaExtension = true;
          } else {
            hasCustomDuePassed = true;
          }
        }
      }

      // Check approved extension requests
      if (!isUnlockedViaExtension) {
        const { data: extData } = await supabaseAdmin
          .from("extension_requests")
          .select("*")
          .eq("faculty_user_id", user.id)
          .eq("status", "approved")
          .order("created_at", { ascending: false });

        if (extData && extData.length > 0) {
          for (const ext of extData) {
            const reqCodes = Array.isArray(ext.requirement_codes)
              ? ext.requirement_codes
              : [];
            const applies =
              reqCodes.length === 0 || reqCodes.includes(requirementCode);
            if (applies && ext.requested_date) {
              const extIso = `${ext.requested_date}T${
                ext.requested_time
                  ? normalizeTime24Hour(ext.requested_time) || "23:59:59"
                  : "23:59:59"
              }+08:00`;
              const extMs = new Date(extIso).getTime();
              if (!Number.isNaN(extMs) && Date.now() <= extMs) {
                isUnlockedViaExtension = true;
                hasCustomDuePassed = false;
                break;
              }
            }
          }
        }
      }
    } catch {
      // Ignore fallback errors and continue validation
    }

    if (isExempted) {
      return NextResponse.json(
        { error: "This requirement is exempted. File uploads are disabled." },
        { status: 400 },
      );
    }

    if ((hasCustomDuePassed || !windowState.isOpen) && !isUnlockedViaExtension) {
      if (hasCustomDuePassed) {
        return NextResponse.json(
          {
            error:
              "The deadline for this requirement has passed. File upload is locked. Please request an extension.",
          },
          { status: 403 },
        );
      }
      return NextResponse.json(
        {
          error:
            "Submission period is currently closed. Please wait for the submission window to open.",
        },
        { status: 403 },
      );
    }

    // 3. Resolve faculty profile
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    const profileId = profile?.id || user.id;

    // Check if an existing submission row can be reused or create target ID
    const { data: existingSubRecord } = await supabaseAdmin
      .from("submissions")
      .select("id")
      .eq("faculty_profile_id", profileId)
      .eq("requirement_code", requirementCode)
      .maybeSingle();

    const targetSubmissionId = existingSubRecord?.id || crypto.randomUUID();
    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_") || "document.pdf";
    const timestamp = Date.now();
    const storagePath = `faculty-submissions/${profileId}/${targetSubmissionId}/${timestamp}_${cleanFileName}`;

    // 4. Generate signed upload URL directly into Supabase Storage
    const { data: signedData, error: signedError } =
      await supabaseAdmin.storage
        .from("faculty-submissions")
        .createSignedUploadUrl(storagePath, { upsert: true });

    if (signedError || !signedData) {
      return NextResponse.json(
        {
          error: signedError?.message || "Failed to generate signed upload URL.",
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      signedUrl: signedData.signedUrl,
      token: signedData.token,
      path: signedData.path,
      storagePath,
      targetSubmissionId,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to prepare file upload.",
      },
      { status: 500 },
    );
  }
}

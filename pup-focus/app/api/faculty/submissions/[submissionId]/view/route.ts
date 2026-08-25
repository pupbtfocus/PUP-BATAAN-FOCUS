import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function getAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function renderNoFileHtml(message?: string) {
  const displayMsg =
    message ||
    "No document file attached to this submission. Please re-upload your document.";
  return new NextResponse(
    `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Document File Unavailable | PUP FOCUS</title>
  <style>
    :root {
      --bg: #0b0f19;
      --card: #151d2f;
      --border: #23304a;
      --text: #f8fafc;
      --text-muted: #94a3b8;
      --gold: #f59e0b;
      --maroon: #800000;
    }
    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f8fafc;
        --card: #ffffff;
        --border: #e2e8f0;
        --text: #0f172a;
        --text-muted: #64748b;
      }
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body {
      background-color: var(--bg);
      color: var(--text);
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      padding: 1.5rem;
    }
    .card {
      background-color: var(--card);
      border: 1px solid var(--border);
      border-radius: 1.25rem;
      padding: 2.5rem 2rem;
      max-width: 480px;
      width: 100%;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.2), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    }
    .icon-wrapper {
      width: 4.5rem;
      height: 4.5rem;
      border-radius: 9999px;
      background-color: rgba(245, 158, 11, 0.12);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 1.25rem;
    }
    .icon {
      width: 2.25rem;
      height: 2.25rem;
      color: var(--gold);
    }
    h1 {
      font-size: 1.25rem;
      font-weight: 700;
      margin-bottom: 0.5rem;
      color: var(--text);
    }
    p {
      font-size: 0.875rem;
      color: var(--text-muted);
      line-height: 1.6;
      margin-bottom: 1.75rem;
    }
    .actions {
      display: flex;
      gap: 0.75rem;
      justify-content: center;
      flex-wrap: wrap;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0.625rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      border-radius: 0.625rem;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s ease-in-out;
    }
    .btn-primary {
      background-color: #800000;
      color: #ffffff;
      border: 1px solid transparent;
    }
    .btn-primary:hover {
      background-color: #990000;
    }
    .btn-secondary {
      background-color: transparent;
      color: var(--text);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover {
      background-color: rgba(255, 255, 255, 0.05);
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon-wrapper">
      <svg class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    </div>
    <h1>Document Not Available</h1>
    <p>${displayMsg}</p>
    <div class="actions">
      <button class="btn btn-secondary" onclick="window.close(); if(history.length > 1) history.back();">Go Back</button>
      <a class="btn btn-primary" href="/faculty/dashboard">Faculty Dashboard</a>
    </div>
  </div>
</body>
</html>`,
    {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

async function discoverAndSignFile(
  adminClient: SupabaseClient,
  sub: { id: string; faculty_profile_id?: string | null; requirement_code?: string | null } | null,
  knownStoragePath?: string | null,
  downloadOptions?: { download?: string | boolean },
): Promise<{ signedUrl: string; resolvedPath: string; mimeType: string } | null> {
  const buckets = ["faculty-submissions", "submissions"];

  // 1. Direct candidate paths test
  if (knownStoragePath) {
    for (const bucket of buckets) {
      const candidates = [
        knownStoragePath,
        knownStoragePath.replace(/^faculty-submissions\//, ""),
        knownStoragePath.replace(/^submissions\//, ""),
        `faculty-submissions/${knownStoragePath.replace(/^faculty-submissions\//, "")}`,
      ];

      for (const p of candidates) {
        if (!p) continue;
        const { data, error } = await adminClient.storage
          .from(bucket)
          .createSignedUrl(p, 3600, downloadOptions);
        if (!error && data?.signedUrl) {
          return {
            signedUrl: data.signedUrl,
            resolvedPath: p,
            mimeType: p.endsWith(".pdf") ? "application/pdf" : "application/octet-stream",
          };
        }
      }
    }
  }

  // 2. Folder listing & discovery in Supabase Storage
  const profileId = sub?.faculty_profile_id;
  const subId = sub?.id;
  const reqCode = sub?.requirement_code;

  const candidateFolders = [
    profileId && subId ? `faculty-submissions/${profileId}/${subId}` : null,
    profileId && subId ? `${profileId}/${subId}` : null,
    profileId && reqCode ? `faculty-submissions/${profileId}/${reqCode}` : null,
    profileId && reqCode ? `${profileId}/${reqCode}` : null,
    subId ? `${subId}` : null,
    profileId ? `faculty-submissions/${profileId}` : null,
    profileId ? `${profileId}` : null,
  ].filter(Boolean) as string[];

  for (const bucket of buckets) {
    for (const folder of candidateFolders) {
      try {
        const { data: files, error } = await adminClient.storage
          .from(bucket)
          .list(folder, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

        if (!error && Array.isArray(files) && files.length > 0) {
          const validFile = files.find((f) => f.name && !f.name.startsWith("."));
          if (validFile) {
            const filePath = `${folder}/${validFile.name}`;
            const { data: signed, error: signErr } = await adminClient.storage
              .from(bucket)
              .createSignedUrl(filePath, 3600, downloadOptions);

            if (!signErr && signed?.signedUrl) {
              return {
                signedUrl: signed.signedUrl,
                resolvedPath: filePath,
                mimeType:
                  (validFile.metadata as { mimetype?: string } | undefined)?.mimetype ||
                  (validFile.name.endsWith(".pdf") ? "application/pdf" : "application/octet-stream"),
              };
            }
          }
        }
      } catch {
        // Continue searching other buckets/folders
      }
    }
  }

  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ submissionId: string }> },
) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resolvedParams = await params;
    const submissionId = resolvedParams.submissionId;

    const url = new URL(request.url);
    const versionId = url.searchParams.get("versionId");
    const download = url.searchParams.get("download");
    const filename = url.searchParams.get("filename");
    const asJson = url.searchParams.get("json") === "true";

    if (!submissionId || submissionId === "undefined" || submissionId === "null") {
      if (asJson) {
        return NextResponse.json({ error: "submissionId is required" }, { status: 400 });
      }
      return renderNoFileHtml("Submission ID is required.");
    }

    const adminClient = getAdminClient();

    // 1. Unconditional Service-Role Lookup in submissions
    let { data: sub } = await adminClient
      .from("submissions")
      .select("id, requirement_code, status, faculty_profile_id")
      .eq("id", submissionId)
      .maybeSingle();

    // 2. Dual-Table Storage Path Resolution in document_versions
    let docVer: {
      id?: string;
      submission_id?: string;
      storage_path?: string;
      file_name?: string;
      mime_type?: string | null;
      size_bytes?: number | null;
    } | null = null;

    if (versionId) {
      const { data: specificVer } = await adminClient
        .from("document_versions")
        .select("id, submission_id, storage_path, file_name, mime_type, size_bytes")
        .eq("id", versionId)
        .maybeSingle();
      docVer = specificVer;
    }

    if (!docVer) {
      const { data: latestVer } = await adminClient
        .from("document_versions")
        .select("id, submission_id, storage_path, file_name, mime_type, size_bytes")
        .or(`submission_id.eq.${submissionId},id.eq.${submissionId}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      docVer = latestVer;
    }

    // If sub was null, but docVer has submission_id, fetch sub from parent
    if (!sub && docVer?.submission_id) {
      const { data: parentSub } = await adminClient
        .from("submissions")
        .select("id, requirement_code, status, faculty_profile_id")
        .eq("id", docVer.submission_id)
        .maybeSingle();
      sub = parentSub;
    }

    // 3. Fallback search across same faculty's requirement submissions if still missing
    if (!docVer?.storage_path && sub?.faculty_profile_id && sub?.requirement_code) {
      const { data: siblingSubmissions } = await adminClient
        .from("submissions")
        .select("id")
        .eq("faculty_profile_id", sub.faculty_profile_id)
        .eq("requirement_code", sub.requirement_code);

      if (siblingSubmissions && siblingSubmissions.length > 0) {
        const subIds = siblingSubmissions.map((s) => s.id);
        const { data: siblingVer } = await adminClient
          .from("document_versions")
          .select("id, submission_id, storage_path, file_name, mime_type, size_bytes")
          .in("submission_id", subIds)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (siblingVer?.storage_path) {
          docVer = siblingVer;
        }
      }
    }

    const targetFileName = filename || docVer?.file_name || undefined;
    const downloadOptions =
      download === "true" || filename
        ? { download: targetFileName || true }
        : undefined;

    // 4. Discover & Sign File in Storage
    const signResult = await discoverAndSignFile(
      adminClient,
      sub,
      docVer?.storage_path,
      downloadOptions,
    );

    if (!signResult) {
      if (asJson) {
        return NextResponse.json(
          {
            error: "No document file attached to this submission. Please re-upload your document.",
          },
          { status: 404 },
        );
      }
      return renderNoFileHtml(
        "No document file attached to this submission. Please re-upload your document.",
      );
    }

    if (asJson) {
      return NextResponse.json({
        success: true,
        downloadUrl: signResult.signedUrl,
        storagePath: signResult.resolvedPath,
        mimeType: docVer?.mime_type || signResult.mimeType,
        sizeBytes: docVer?.size_bytes || null,
      });
    }

    return NextResponse.redirect(signResult.signedUrl);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

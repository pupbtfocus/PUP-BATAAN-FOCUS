import { NextResponse, type NextRequest } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServerSupabaseClient } from "@/lib/supabase/server";

function getStorageAdminClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

function getMimeType(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return "application/pdf";
    case "png":
      return "image/png";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "svg":
      return "image/svg+xml";
    case "docx":
      return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    case "doc":
      return "application/msword";
    case "xlsx":
      return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    case "xls":
      return "application/vnd.ms-excel";
    case "pptx":
      return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    case "ppt":
      return "application/vnd.ms-powerpoint";
    case "txt":
      return "text/plain";
    default:
      return "application/octet-stream";
  }
}

export async function GET(request: NextRequest) {
  try {
    // Verify admin role
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const path = url.searchParams.get("path");
    const download = url.searchParams.get("download");
    const filename = url.searchParams.get("filename");
    const asJson =
      url.searchParams.get("json") === "true" ||
      url.searchParams.get("format") === "json";

    if (!path) {
      return NextResponse.json({ error: "path is required" }, { status: 400 });
    }

    const supabase = getStorageAdminClient();
    const options =
      download === "true" || filename
        ? { download: filename || path.split("/").pop() || true }
        : undefined;

    const buckets = ["faculty-submissions", "submissions"];
    const candidatePaths = [
      path,
      path.replace(/^faculty-submissions\//, ""),
      path.replace(/^submissions\//, ""),
      `faculty-submissions/${path.replace(/^faculty-submissions\//, "")}`,
    ].filter((p, idx, arr) => Boolean(p) && arr.indexOf(p) === idx);

    let signedUrl: string | null = null;
    let fileBlob: Blob | null = null;
    let lastError: string | undefined;

    for (const bucket of buckets) {
      for (const testPath of candidatePaths) {
        if (!signedUrl) {
          const { data: sData, error: sErr } = await supabase.storage
            .from(bucket)
            .createSignedUrl(testPath, 3600, options);
          if (sData?.signedUrl) {
            signedUrl = sData.signedUrl;
          } else if (sErr) {
            lastError = sErr.message;
          }
        }

        if (!fileBlob) {
          const { data: fData, error: fErr } = await supabase.storage
            .from(bucket)
            .download(testPath);
          if (fData) {
            fileBlob = fData;
          } else if (fErr) {
            lastError = fErr.message;
          }
        }

        if (signedUrl && fileBlob) break;
      }
      if (signedUrl && fileBlob) break;
    }

    // Fallback: directory listing match
    if (!signedUrl || !fileBlob) {
      const cleanPath = path.replace(/^faculty-submissions\//, "").replace(/^submissions\//, "");
      const pathParts = cleanPath.split("/");
      const targetFileName = pathParts.pop();
      const folder = pathParts.join("/");

      for (const bucket of buckets) {
        try {
          const { data: files } = await supabase.storage
            .from(bucket)
            .list(folder, { limit: 20 });
          if (files && files.length > 0) {
            const matched = files.find(
              (f) =>
                f.name === targetFileName ||
                (targetFileName && f.name.includes(targetFileName)) ||
                (targetFileName && targetFileName.includes(f.name))
            );
            if (matched) {
              const matchedPath = folder ? `${folder}/${matched.name}` : matched.name;
              if (!signedUrl) {
                const { data: sData } = await supabase.storage
                  .from(bucket)
                  .createSignedUrl(matchedPath, 3600, options);
                if (sData?.signedUrl) signedUrl = sData.signedUrl;
              }
              if (!fileBlob) {
                const { data: fData } = await supabase.storage
                  .from(bucket)
                  .download(matchedPath);
                if (fData) fileBlob = fData;
              }
              if (signedUrl && fileBlob) break;
            }
          }
        } catch {}
      }
    }

    if (!signedUrl && !fileBlob) {
      return NextResponse.json(
        {
          error: "Failed to generate download link",
          details: lastError || "File not found in storage",
        },
        { status: 500 },
      );
    }

    if (asJson) {
      return NextResponse.json({
        success: true,
        signedUrl: signedUrl,
        url: signedUrl,
      });
    }

    if (fileBlob) {
      const fileBuffer = await fileBlob.arrayBuffer();
      const cleanFilename = filename || path.split("/").pop() || "document.pdf";
      const contentType =
        fileBlob.type && fileBlob.type !== "application/octet-stream"
          ? fileBlob.type
          : getMimeType(cleanFilename);

      return new NextResponse(fileBuffer, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Content-Disposition":
            download === "true"
              ? `attachment; filename="${encodeURIComponent(cleanFilename)}"`
              : `inline; filename="${encodeURIComponent(cleanFilename)}"`,
          "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
          "X-Frame-Options": "SAMEORIGIN",
          "Content-Security-Policy": "frame-ancestors 'self'",
        },
      });
    }

    return NextResponse.redirect(signedUrl!);
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

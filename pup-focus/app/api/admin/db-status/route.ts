import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { ROLE } from "@/config/roles";
import { APP_CONFIG } from "@/config/app";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";

export const dynamic = "force-dynamic";
export const revalidate = 0;

// Free Tier Defaults: 500 MB DB + 1 GB File Storage (50 MB max upload)
const FREE_MAX_DB_BYTES = 500 * 1024 * 1024;
const FREE_MAX_BUCKET_BYTES = 1024 * 1024 * 1024;
const FREE_MAX_UPLOAD_MB = 50;

// Pro Tier Defaults: 8 GB DB + 100 GB File Storage (5 GB / 5,120 MB max upload)
const PRO_MAX_DB_BYTES = 8 * 1024 * 1024 * 1024;
const PRO_MAX_BUCKET_BYTES = 100 * 1024 * 1024 * 1024;
const PRO_MAX_UPLOAD_MB = 5120;

const WARNING_THRESHOLD = 0.8; // 80%
const CRITICAL_THRESHOLD = 0.9; // 90%

const ALL_PUBLIC_TABLES: Array<{ name: string; avgRowBytes: number }> = [
  { name: "profiles", avgRowBytes: 1024 },
  { name: "user_roles", avgRowBytes: 256 },
  { name: "roles", avgRowBytes: 256 },
  { name: "departments", avgRowBytes: 512 },
  { name: "programs", avgRowBytes: 512 },
  { name: "courses", avgRowBytes: 512 },
  { name: "academic_terms", avgRowBytes: 512 },
  { name: "submission_windows", avgRowBytes: 768 },
  { name: "window_deadlines", avgRowBytes: 512 },
  { name: "requirements", avgRowBytes: 768 },
  { name: "submissions", avgRowBytes: 2048 },
  { name: "submission_files", avgRowBytes: 1024 },
  { name: "submission_reviews", avgRowBytes: 1024 },
  { name: "extension_requests", avgRowBytes: 1024 },
  { name: "extension_audit_logs", avgRowBytes: 1024 },
  { name: "notifications", avgRowBytes: 1024 },
  { name: "audit_logs", avgRowBytes: 1024 },
  { name: "system_backups", avgRowBytes: 2048 },
  { name: "system_settings", avgRowBytes: 512 },
  { name: "archive_records", avgRowBytes: 2048 },
];

function isSuperAdminRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.toLowerCase().trim();
  return r === ROLE.ADMIN || r === ROLE.SUPER_ADMIN || r === "super_admin" || r === "superadmin";
}

interface CapacityBreakdown {
  dbBytes: number;
  bucketBytes: number;
  tableCount: number;
  bucketCount: number;
  objectCount: number;
  detectedTier: "free" | "pro";
  maxDbBytes: number;
  maxBucketBytes: number;
  maxUploadFileMb: number;
}

async function scanStorageBucketsViaApi(
  supabase: ReturnType<typeof getServiceRoleClient>
): Promise<{
  bucketBytes: number;
  bucketCount: number;
  objectCount: number;
  maxBucketFileLimitBytes: number;
}> {
  let bucketBytes = 0;
  let bucketCount = 0;
  let objectCount = 0;
  let maxBucketFileLimitBytes = 0;

  try {
    const { data: buckets } = await supabase.storage.listBuckets();
    if (Array.isArray(buckets)) {
      bucketCount = buckets.length;
      for (const bucket of buckets) {
        const fileLimit = Number((bucket as { file_size_limit?: number | null }).file_size_limit || 0);
        if (fileLimit > maxBucketFileLimitBytes) {
          maxBucketFileLimitBytes = fileLimit;
        }
        try {
          const { data: rootItems } = await supabase.storage
            .from(bucket.name)
            .list("", { limit: 1000 });
          if (!Array.isArray(rootItems)) continue;

          for (const item of rootItems) {
            const size = Number(
              (item.metadata as Record<string, unknown> | null)?.size ??
                (item.metadata as Record<string, unknown> | null)?.contentLength ??
                0
            );
            if (size > 0) {
              bucketBytes += size;
              objectCount += 1;
            } else if (!item.id) {
              const { data: subItems } = await supabase.storage
                .from(bucket.name)
                .list(item.name, { limit: 1000 });
              if (Array.isArray(subItems)) {
                for (const sub of subItems) {
                  const subSize = Number(
                    (sub.metadata as Record<string, unknown> | null)?.size ??
                      (sub.metadata as Record<string, unknown> | null)?.contentLength ??
                      0
                  );
                  if (subSize > 0) {
                    bucketBytes += subSize;
                    objectCount += 1;
                  }
                }
              }
            }
          }
        } catch {
          // Ignore individual bucket list errors
        }
      }
    }
  } catch {
    // Ignore storage API errors
  }

  if (bucketBytes === 0) {
    try {
      const { data: submissions } = await supabase
        .from("submissions")
        .select("file_size, files");
      if (Array.isArray(submissions)) {
        for (const s of submissions as Array<{
          file_size?: number | null;
          files?: Array<{ size?: number; file_size?: number }> | null;
        }>) {
          if (typeof s.file_size === "number" && s.file_size > 0) {
            bucketBytes += s.file_size;
            objectCount += 1;
          }
          if (Array.isArray(s.files)) {
            for (const f of s.files) {
              const fSize = Number(f?.size ?? f?.file_size ?? 0);
              if (fSize > 0) {
                bucketBytes += fSize;
                objectCount += 1;
              }
            }
          }
        }
      }
    } catch {
      // Ignore
    }

    try {
      const { data: backups } = await supabase
        .from("system_backups")
        .select("file_size_kb");
      if (Array.isArray(backups)) {
        for (const b of backups) {
          const kb = Number(b.file_size_kb) || 0;
          if (kb > 0) {
            bucketBytes += kb * 1024;
            objectCount += 1;
          }
        }
      }
    } catch {
      // Ignore
    }
  }

  return { bucketBytes, bucketCount, objectCount, maxBucketFileLimitBytes };
}

async function computeAllTablesAndBucketsCapacity(
  supabase: ReturnType<typeof getServiceRoleClient>
): Promise<CapacityBreakdown> {
  const envTier = (process.env.SUPABASE_PLAN || process.env.SUPABASE_TIER || "").toLowerCase().trim();
  const isEnvPro = envTier === "pro" || envTier === "team" || envTier === "enterprise";

  // 1. Try detailed RPC (`get_storage_capacity_breakdown`) first
  try {
    const { data: breakdown, error } = await supabase.rpc("get_storage_capacity_breakdown");
    if (!error && breakdown && typeof breakdown === "object") {
      const b = breakdown as Record<string, unknown>;
      const dbBytes = Number(b.dbBytes) || 0;
      let bucketBytes = Number(b.bucketBytes) || 0;
      const tableCount = Number(b.tableCount) || ALL_PUBLIC_TABLES.length;
      let bucketCount = Number(b.bucketCount) || 0;
      let objectCount = Number(b.objectCount) || 0;
      let maxBucketFileLimitBytes = 0;

      if (bucketBytes === 0 && bucketCount === 0) {
        const scanned = await scanStorageBucketsViaApi(supabase);
        bucketBytes = scanned.bucketBytes;
        bucketCount = scanned.bucketCount;
        objectCount = scanned.objectCount;
        maxBucketFileLimitBytes = scanned.maxBucketFileLimitBytes;
      }

      const rpcIsPro =
        String(b.detectedTier || "").toLowerCase() === "pro" ||
        isEnvPro ||
        dbBytes > FREE_MAX_DB_BYTES ||
        bucketBytes > FREE_MAX_BUCKET_BYTES ||
        maxBucketFileLimitBytes > 50 * 1024 * 1024;

      const detectedTier: "free" | "pro" = rpcIsPro ? "pro" : "free";
      const maxDbBytes = Number(b.maxDbBytes) > FREE_MAX_DB_BYTES || rpcIsPro
        ? Number(b.maxDbBytes) > FREE_MAX_DB_BYTES
          ? Number(b.maxDbBytes)
          : PRO_MAX_DB_BYTES
        : FREE_MAX_DB_BYTES;
      const maxBucketBytes = Number(b.maxBucketBytes) > FREE_MAX_BUCKET_BYTES || rpcIsPro
        ? Number(b.maxBucketBytes) > FREE_MAX_BUCKET_BYTES
          ? Number(b.maxBucketBytes)
          : PRO_MAX_BUCKET_BYTES
        : FREE_MAX_BUCKET_BYTES;
      const maxUploadFileMb = rpcIsPro
        ? Number(b.maxUploadFileMb) > FREE_MAX_UPLOAD_MB
          ? Number(b.maxUploadFileMb)
          : PRO_MAX_UPLOAD_MB
        : FREE_MAX_UPLOAD_MB;

      if (dbBytes > 0) {
        return {
          dbBytes,
          bucketBytes,
          tableCount,
          bucketCount,
          objectCount,
          detectedTier,
          maxDbBytes,
          maxBucketBytes,
          maxUploadFileMb,
        };
      }
    }
  } catch {
    // Fall through
  }

  // 2. Try `get_database_size_bytes` RPC + Storage Buckets API scan
  let dbBytes = 0;
  try {
    const { data: rpcBytes, error: rpcError } = await supabase.rpc("get_database_size_bytes");
    if (!rpcError && typeof rpcBytes === "number" && rpcBytes > 0) {
      dbBytes = rpcBytes;
    }
  } catch {
    // Ignore
  }

  let countedTables = 0;
  if (dbBytes === 0) {
    dbBytes = 8 * 1024 * 1024; // Base Postgres catalog & index overhead (~8 MB)
    await Promise.all(
      ALL_PUBLIC_TABLES.map(async (tbl) => {
        try {
          const { count, error } = await supabase
            .from(tbl.name)
            .select("*", { count: "exact", head: true });
          if (!error) {
            countedTables += 1;
            if (typeof count === "number" && count > 0) {
              dbBytes += count * tbl.avgRowBytes;
            }
          }
        } catch {
          // Table may not exist in schema
        }
      })
    );
  } else {
    countedTables = ALL_PUBLIC_TABLES.length;
  }

  const scannedBuckets = await scanStorageBucketsViaApi(supabase);

  const isProDetected =
    isEnvPro ||
    dbBytes > FREE_MAX_DB_BYTES ||
    scannedBuckets.bucketBytes > FREE_MAX_BUCKET_BYTES ||
    scannedBuckets.maxBucketFileLimitBytes > 50 * 1024 * 1024;

  return {
    dbBytes,
    bucketBytes: scannedBuckets.bucketBytes,
    tableCount: countedTables || ALL_PUBLIC_TABLES.length,
    bucketCount: scannedBuckets.bucketCount,
    objectCount: scannedBuckets.objectCount,
    detectedTier: isProDetected ? "pro" : "free",
    maxDbBytes: isProDetected ? PRO_MAX_DB_BYTES : FREE_MAX_DB_BYTES,
    maxBucketBytes: isProDetected ? PRO_MAX_BUCKET_BYTES : FREE_MAX_BUCKET_BYTES,
    maxUploadFileMb: isProDetected ? PRO_MAX_UPLOAD_MB : FREE_MAX_UPLOAD_MB,
  };
}

export async function GET(request: NextRequest) {
  try {
    const sessionClient = await createServerSupabaseClient();
    const {
      data: { user },
    } = await sessionClient.auth.getUser();

    let requesterRole =
      (user?.user_metadata?.role as string | undefined) ??
      (user?.app_metadata?.role as string | undefined);

    const supabase = getServiceRoleClient();

    if (user && !isSuperAdminRole(requesterRole)) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id, user_roles(roles(code))")
        .eq("user_id", user.id)
        .maybeSingle();

      const userRoles = profile?.user_roles as Array<{ roles: { code: string } | null }> | undefined;
      const dbRoleCode = userRoles?.[0]?.roles?.code;
      if (isSuperAdminRole(dbRoleCode)) {
        requesterRole = dbRoleCode;
      }
    }

    if (!user || !isSuperAdminRole(requesterRole)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const capacity = await computeAllTablesAndBucketsCapacity(supabase);

    const simulateTierParam = request.nextUrl.searchParams.get("simulateTier")?.toLowerCase();
    const detectedTier: "free" | "pro" =
      simulateTierParam === "pro"
        ? "pro"
        : simulateTierParam === "free"
        ? "free"
        : capacity.detectedTier;

    const maxDbBytes = Number(
      process.env.MAX_DB_SIZE_BYTES ||
        (detectedTier === "pro" ? PRO_MAX_DB_BYTES : capacity.maxDbBytes)
    );
    const maxBucketBytes = Number(
      process.env.MAX_BUCKET_SIZE_BYTES ||
        (detectedTier === "pro" ? PRO_MAX_BUCKET_BYTES : capacity.maxBucketBytes)
    );
    const maxUploadFileMb =
      detectedTier === "pro" ? PRO_MAX_UPLOAD_MB : capacity.maxUploadFileMb;
    const maxBytes = maxDbBytes + maxBucketBytes;

    let dbBytes = capacity.dbBytes;
    let bucketBytes = capacity.bucketBytes;

    // Optional query params for testing simulated threshold in dev preview
    const simulatePercentParam = request.nextUrl.searchParams.get("simulatePercent");
    const simulateDbPercentParam = request.nextUrl.searchParams.get("simulateDbPercent");
    const simulateBucketPercentParam = request.nextUrl.searchParams.get("simulateBucketPercent");
    const isSimulated =
      (simulatePercentParam !== null && !Number.isNaN(Number(simulatePercentParam))) ||
      (simulateDbPercentParam !== null && !Number.isNaN(Number(simulateDbPercentParam))) ||
      (simulateBucketPercentParam !== null && !Number.isNaN(Number(simulateBucketPercentParam)));

    if (isSimulated) {
      const dbPct =
        simulateDbPercentParam !== null && !Number.isNaN(Number(simulateDbPercentParam))
          ? Math.min(100, Math.max(0, Number(simulateDbPercentParam)))
          : Math.min(100, Math.max(0, Number(simulatePercentParam ?? 0)));
      const bucketPct =
        simulateBucketPercentParam !== null && !Number.isNaN(Number(simulateBucketPercentParam))
          ? Math.min(100, Math.max(0, Number(simulateBucketPercentParam)))
          : Math.min(100, Math.max(0, Number(simulatePercentParam ?? 0)));

      dbBytes = Math.round((dbPct / 100) * maxDbBytes);
      bucketBytes = Math.round((bucketPct / 100) * maxBucketBytes);
    }

    const usedBytes = dbBytes + bucketBytes;

    const dbRatio = maxDbBytes > 0 ? dbBytes / maxDbBytes : 0;
    const bucketRatio = maxBucketBytes > 0 ? bucketBytes / maxBucketBytes : 0;
    const highestRatio = Math.max(dbRatio, bucketRatio);

    const dbUsagePercent = Math.min(100, Math.round(dbRatio * 1000) / 10);
    const bucketUsagePercent = Math.min(100, Math.round(bucketRatio * 1000) / 10);
    const usagePercent = Math.min(100, Math.round(highestRatio * 1000) / 10);

    const status: "healthy" | "warning" | "critical" =
      highestRatio >= CRITICAL_THRESHOLD
        ? "critical"
        : highestRatio >= WARNING_THRESHOLD
        ? "warning"
        : "healthy";

    const usedMb = Number((usedBytes / (1024 * 1024)).toFixed(2));
    const maxMb = Number((maxBytes / (1024 * 1024)).toFixed(0));
    const dbMb = Number((dbBytes / (1024 * 1024)).toFixed(2));
    const maxDbMb = Number((maxDbBytes / (1024 * 1024)).toFixed(0));
    const bucketMb = Number((bucketBytes / (1024 * 1024)).toFixed(2));
    const maxBucketMb = Number((maxBucketBytes / (1024 * 1024)).toFixed(0));

    // Create an in-app notification in the Notification Bell Drawer when database or file storage is about to be full
    if (status !== "healthy") {
      const twelveHoursAgo = new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString();
      const { data: recentAlert } = isSimulated
        ? { data: null }
        : await supabase
            .from("notifications")
            .select("id")
            .eq("user_id", user.id)
            .eq("type", "DB_CAPACITY_ALERT")
            .gte("created_at", twelveHoursAgo)
            .limit(1)
            .maybeSingle();

      if (!recentAlert) {
        const alertTitle =
          status === "critical"
            ? `Critical Alert: Database & File Storage at ${usagePercent}%`
            : `Storage Warning: Database & File Storage Reached ${usagePercent}%`;
        const alertMessage = `Postgres Database (${capacity.tableCount} tables): ${dbMb} MB / ${maxDbMb} MB (${dbUsagePercent}%) • File Storage (${capacity.bucketCount || 1} buckets): ${bucketMb} MB / ${maxBucketMb} MB (${bucketUsagePercent}%). Please archive completed academic terms or clean up files in Backups & Archive.`;

        await supabase.from("notifications").insert({
          user_id: user.id,
          title: alertTitle,
          message: alertMessage,
          type: "DB_CAPACITY_ALERT",
          is_read: false,
          metadata: {
            usedBytes,
            maxBytes,
            dbBytes,
            maxDbBytes,
            bucketBytes,
            maxBucketBytes,
            dbMb,
            maxDbMb,
            dbUsagePercent,
            bucketMb,
            maxBucketMb,
            bucketUsagePercent,
            detectedTier,
            tableCount: capacity.tableCount,
            bucketCount: capacity.bucketCount,
            objectCount: capacity.objectCount,
            usagePercent,
            status,
          },
          created_at: new Date().toISOString(),
        });

        const superAdminEmail =
          process.env.SUPER_ADMIN_EMAIL ||
          APP_CONFIG.superAdminEmail ||
          user.email;

        if (
          !isSimulated &&
          superAdminEmail &&
          process.env.SMTP_HOST &&
          process.env.SMTP_USER &&
          process.env.SMTP_PASS
        ) {
          const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: Number(process.env.SMTP_PORT ?? 587),
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS,
            },
          });

          await transporter
            .sendMail({
              from: process.env.SMTP_FROM ?? process.env.SMTP_USER,
              to: superAdminEmail,
              subject: `[PUP FOCUS] ${alertTitle}`,
              text: alertMessage,
            })
            .catch(() => {});
        }
      }
    }

    return NextResponse.json({
      usedBytes,
      maxBytes,
      usedMb,
      maxMb,
      dbBytes,
      maxDbBytes,
      dbMb,
      maxDbMb,
      dbUsagePercent,
      bucketBytes,
      maxBucketBytes,
      bucketMb,
      maxBucketMb,
      bucketUsagePercent,
      maxUploadFileMb,
      detectedTier,
      tableCount: capacity.tableCount,
      bucketCount: capacity.bucketCount,
      objectCount: capacity.objectCount,
      usagePercent,
      status,
      warningThresholdPercent: WARNING_THRESHOLD * 100,
      criticalThresholdPercent: CRITICAL_THRESHOLD * 100,
    });
  } catch (error) {
    console.error("[DB_STATUS_GET_ERROR]", error);
    return NextResponse.json(
      { error: "Failed to check database capacity" },
      { status: 500 }
    );
  }
}

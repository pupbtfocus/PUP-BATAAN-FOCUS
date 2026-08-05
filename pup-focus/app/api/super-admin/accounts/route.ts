import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getServiceRoleClient } from "@/lib/supabase/service-role";
import { ROLE } from "@/config/roles";

async function resolveSignedAvatarUrl(
  supabaseAdmin: any,
  email?: string | null,
  rawAvatarUrl?: string | null
): Promise<string | null> {
  // 1. If rawAvatarUrl already contains a valid signed token, check if working or return
  if (rawAvatarUrl && rawAvatarUrl.includes("token=") && rawAvatarUrl.startsWith("http")) {
    return rawAvatarUrl;
  }

  // 2. If rawAvatarUrl is a storage path or public URL without token, extract storage path
  if (rawAvatarUrl) {
    let storagePath = rawAvatarUrl;
    if (storagePath.includes("/compliance-private/")) {
      storagePath = storagePath.split("/compliance-private/")[1].split("?")[0];
    } else if (storagePath.startsWith("http")) {
      const match = storagePath.match(/admin-profile-images\/[^\s?]+/);
      if (match) {
        storagePath = match[0];
      }
    }

    if (storagePath.includes("admin-profile-images/")) {
      const { data, error } = await supabaseAdmin.storage
        .from("compliance-private")
        .createSignedUrl(storagePath, 60 * 60 * 24);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  // 3. Fallback: Search compliance-private bucket under admin-profile-images/${email}
  if (email) {
    const folderPath = `admin-profile-images/${email}`;
    const { data: files } = await supabaseAdmin.storage
      .from("compliance-private")
      .list(folderPath, { limit: 10, sortBy: { column: "created_at", order: "desc" } });

    if (files && files.length > 0) {
      const latestFile = files[0];
      const filePath = `${folderPath}/${latestFile.name}`;
      const { data, error } = await supabaseAdmin.storage
        .from("compliance-private")
        .createSignedUrl(filePath, 60 * 60 * 24);

      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
  }

  return null;
}

export async function GET() {
  const sessionClient = await createServerSupabaseClient();
  const {
    data: { user },
  } = await sessionClient.auth.getUser();

  const requesterRole =
    (user?.user_metadata?.role as string | undefined) ??
    (user?.app_metadata?.role as string | undefined);

  if (
    !user ||
    (requesterRole !== ROLE.SUPER_ADMIN && requesterRole !== ROLE.ADMIN)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const supabaseAdmin = getServiceRoleClient();

    // Fetch users directly via Auth Admin API using Service Role
    const {
      data: { users },
      error: authError,
    } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });

    if (authError) {
      console.error("Super Admin auth fetch error:", authError);
      return NextResponse.json({ error: authError.message }, { status: 500 });
    }

    // Try fetching profiles for supplementary avatar_url & full_name
    let profileMap = new Map<string, { full_name?: string | null; avatar_url?: string | null }>();
    try {
      const { data: profiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, avatar_url");
      if (profiles) {
        profileMap = new Map(profiles.map((p) => [p.id, p]));
      }
    } catch {
      // Ignore profiles table query error if schema differs
    }

    const adminAccounts = await Promise.all(
      (users ?? [])
        .filter((u) => {
          const rawRole = (
            u.user_metadata?.role ||
            u.app_metadata?.role ||
            (u as any).role ||
            ""
          ).toString().toLowerCase().trim();

          return (
            rawRole.includes("admin") ||
            rawRole.includes("super") ||
            rawRole === "admin" ||
            rawRole === "super_admin" ||
            rawRole === "superadmin"
          );
        })
        .map(async (u) => {
          const rawRole = (
            u.user_metadata?.role ||
            u.app_metadata?.role ||
            (u as any).role ||
            "admin"
          ).toString().toLowerCase().trim();

          let normalizedRole = "admin";
          if (rawRole.includes("super")) {
            normalizedRole = "super_admin";
          } else if (rawRole.includes("admin")) {
            normalizedRole = "admin";
          }

          const profile = profileMap.get(u.id);
          const fullName =
            profile?.full_name ||
            u.user_metadata?.full_name ||
            u.user_metadata?.name ||
            u.email?.split("@")[0] ||
            "Admin User";
          const rawAvatarUrl =
            profile?.avatar_url || u.user_metadata?.avatar_url || null;

          const signedAvatarUrl = await resolveSignedAvatarUrl(
            supabaseAdmin,
            u.email,
            rawAvatarUrl
          );

          return {
            id: u.id,
            email: u.email ?? "",
            full_name: fullName,
            role: normalizedRole,
            avatar_url: signedAvatarUrl,
            created_at: u.created_at,
            status: "active",
          };
        })
    );

    console.log("=== SUPER ADMIN ACCOUNTS API RESPONSE ===", JSON.stringify(adminAccounts, null, 2));

    return NextResponse.json({
      success: true,
      accounts: adminAccounts || [],
    });
  } catch (err: any) {
    console.error("Super Admin fetch error:", err);
    return NextResponse.json(
      { error: err.message || "Failed to load admin accounts" },
      { status: 500 }
    );
  }
}

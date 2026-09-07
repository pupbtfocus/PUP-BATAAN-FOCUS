export async function resolveAdminAvatarUrl(
  supabaseAdmin: any,
  user: {
    id: string;
    email?: string | null;
    user_metadata?: Record<string, any>;
  }
): Promise<string | null> {
  const metadata = user.user_metadata || {};
  const email = user.email || "";
  const userId = user.id;

  // 1. Direct check: profile_image_path stored in user_metadata (compliance-private)
  const profileImagePath = metadata.profile_image_path;
  const profileImageBucket = metadata.profile_image_bucket || "compliance-private";
  if (profileImagePath && typeof profileImagePath === "string" && profileImagePath.trim()) {
    try {
      const cleanPath = profileImagePath.trim().replace(/^\/+/, "");
      const { data: signed, error: signErr } = await supabaseAdmin.storage
        .from(profileImageBucket)
        .createSignedUrl(cleanPath, 60 * 60 * 24 * 7); // 7 days valid

      if (!signErr && signed?.signedUrl) {
        return signed.signedUrl;
      }
    } catch {}
  }

  // 2. Search compliance-private bucket under admin-profile-images/${email}
  if (email) {
    try {
      const folderPath = `admin-profile-images/${email}`;
      const { data: files } = await supabaseAdmin.storage
        .from("compliance-private")
        .list(folderPath, { limit: 5, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("compliance-private")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        if (!error && signed?.signedUrl) {
          return signed.signedUrl;
        }
      }
    } catch {}
  }

  // 3. Search compliance-private bucket under faculty-profile-images/${email}
  if (email) {
    try {
      const folderPath = `faculty-profile-images/${email}`;
      const { data: files } = await supabaseAdmin.storage
        .from("compliance-private")
        .list(folderPath, { limit: 5, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("compliance-private")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        if (!error && signed?.signedUrl) {
          return signed.signedUrl;
        }
      }
    } catch {}
  }

  // 4. Check if raw avatar_url is an external HTTP URL (e.g. Google avatar)
  const rawAvatarUrl = metadata.avatar_url || metadata.picture;
  if (rawAvatarUrl && typeof rawAvatarUrl === "string" && rawAvatarUrl.trim()) {
    const trimmed = rawAvatarUrl.trim();
    // Exclude broken local blobs or unauthenticated public urls pointing to non-existent avatars bucket
    if (
      trimmed.startsWith("http") &&
      !trimmed.includes("blob:") &&
      !trimmed.includes("/storage/v1/object/public/avatars/")
    ) {
      return trimmed;
    }

    if (trimmed.includes("compliance-private/")) {
      const path = trimmed.split("compliance-private/")[1].split("?")[0];
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("compliance-private")
          .createSignedUrl(path, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) return signed.signedUrl;
      } catch {}
    }
  }

  // 5. Search avatars bucket under admin/${userId} if bucket exists
  if (userId) {
    try {
      const folderPath = `admin/${userId}`;
      const { data: files } = await supabaseAdmin.storage
        .from("avatars")
        .list(folderPath, { limit: 5, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: publicData } = supabaseAdmin.storage
          .from("avatars")
          .getPublicUrl(filePath);

        if (publicData?.publicUrl) {
          return publicData.publicUrl;
        }
      }
    } catch {}
  }

  return null;
}

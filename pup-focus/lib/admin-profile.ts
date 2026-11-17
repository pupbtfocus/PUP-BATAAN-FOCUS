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

  // 1. Direct check: profile_image_path stored in user_metadata (profile-pictures)
  const profileImagePath = metadata.profile_image_path;
  const profileImageBucket = metadata.profile_image_bucket || "profile-pictures";
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

  // 2. Search profile-pictures bucket under admin-profile-images/${email}
  if (email) {
    try {
      const folderPath = `admin-profile-images/${email}`;
      const { data: files } = await supabaseAdmin.storage
        .from("profile-pictures")
        .list(folderPath, { limit: 5, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("profile-pictures")
          .createSignedUrl(filePath, 60 * 60 * 24 * 7);

        if (!error && signed?.signedUrl) {
          return signed.signedUrl;
        }
      }
    } catch {}
  }

  // 3. Search profile-pictures bucket under faculty-profile-images/${email}
  if (email) {
    try {
      const folderPath = `faculty-profile-images/${email}`;
      const { data: files } = await supabaseAdmin.storage
        .from("profile-pictures")
        .list(folderPath, { limit: 5, sortBy: { column: "created_at", order: "desc" } });

      if (files && files.length > 0) {
        const latestFile = files[0];
        const filePath = `${folderPath}/${latestFile.name}`;
        const { data: signed, error } = await supabaseAdmin.storage
          .from("profile-pictures")
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

    if (trimmed.includes("profile-pictures/")) {
      const path = trimmed.split("profile-pictures/")[1].split("?")[0];
      try {
        const { data: signed } = await supabaseAdmin.storage
          .from("profile-pictures")
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

export function extractStoragePathFromUrl(
  rawUrl: unknown,
  bucketName: string
): string | null {
  if (typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.startsWith("blob:") || trimmed.startsWith("data:")) {
    return null;
  }

  const marker = `/${bucketName}/`;
  if (trimmed.includes(marker)) {
    const after = trimmed.split(marker)[1]?.split("?")[0]?.trim();
    if (after) {
      try {
        return decodeURIComponent(after).replace(/^\/+/, "") || null;
      } catch {
        return after.replace(/^\/+/, "") || null;
      }
    }
  }

  if (!trimmed.startsWith("http://") && !trimmed.startsWith("https://")) {
    const bucketPrefix = `${bucketName}/`;
    const withoutPrefix = trimmed.startsWith(bucketPrefix)
      ? trimmed.slice(bucketPrefix.length)
      : trimmed;
    return withoutPrefix.split("?")[0]?.replace(/^\/+/, "") || null;
  }

  return null;
}

export async function cleanupOldProfileImages(
  supabaseAdmin: any,
  options: {
    keepBucket?: string | null;
    keepPath?: string | null;
    previousPaths?: Array<{ bucket?: string | null; path?: unknown }>;
    rawUrls?: Array<unknown>;
    folders?: Array<{ bucket: string; folder?: string | null }>;
    defaultBucket?: string;
  }
): Promise<void> {
  const defaultBucket = options.defaultBucket || "profile-pictures";
  const keepBucket = options.keepBucket || defaultBucket;
  const cleanKeepPath =
    typeof options.keepPath === "string"
      ? options.keepPath.trim().replace(/^\/+/, "")
      : "";
  const keepKey = cleanKeepPath ? `${keepBucket}::${cleanKeepPath}` : null;

  const toDeleteByBucket = new Map<string, Set<string>>();
  const queueDelete = (bucket: string, rawPath: unknown) => {
    if (typeof rawPath !== "string") return;
    const clean = rawPath.trim().replace(/^\/+/, "");
    if (!clean) return;
    if (keepKey && `${bucket}::${clean}` === keepKey) return;
    if (!toDeleteByBucket.has(bucket)) {
      toDeleteByBucket.set(bucket, new Set());
    }
    toDeleteByBucket.get(bucket)!.add(clean);
  };

  for (const prev of options.previousPaths ?? []) {
    queueDelete(prev.bucket || defaultBucket, prev.path);
  }

  const inspectedBuckets = Array.from(
    new Set([defaultBucket, "profile-pictures", "avatars"])
  );
  for (const rawUrl of options.rawUrls ?? []) {
    for (const bucket of inspectedBuckets) {
      const extracted = extractStoragePathFromUrl(rawUrl, bucket);
      if (extracted) {
        queueDelete(bucket, extracted);
      }
    }
  }

  const seenFolders = new Set<string>();
  for (const entry of options.folders ?? []) {
    const cleanFolder = (entry.folder || "").trim().replace(/^\/+|\/+$/g, "");
    if (!cleanFolder) continue;
    const folderKey = `${entry.bucket}::${cleanFolder}`;
    if (seenFolders.has(folderKey)) continue;
    seenFolders.add(folderKey);

    try {
      const { data: files } = await supabaseAdmin.storage
        .from(entry.bucket)
        .list(cleanFolder, { limit: 100 });

      for (const file of files ?? []) {
        if (
          !file?.name ||
          file.name === ".emptyFolderPlaceholder" ||
          file.id === null
        ) {
          continue;
        }
        queueDelete(entry.bucket, `${cleanFolder}/${file.name}`);
      }
    } catch {}
  }

  for (const [bucket, pathsSet] of toDeleteByBucket.entries()) {
    const paths = Array.from(pathsSet);
    if (paths.length === 0) continue;
    try {
      await supabaseAdmin.storage.from(bucket).remove(paths);
    } catch {}
  }
}

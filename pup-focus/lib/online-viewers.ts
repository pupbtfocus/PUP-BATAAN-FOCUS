/**
 * Online Document Viewers Utility
 * Provides Google Docs/Sheets/Drive Viewer and Microsoft Office Online Viewer URLs
 * for non-PDF documents (Excel, Word, PowerPoint, CSV, etc.)
 */

export interface OnlineViewerOptions {
  storagePath?: string | null;
  submissionId?: string | null;
  currentUrl?: string | null;
}

export function getGoogleDocsViewerUrl(directUrl: string, embedded = false): string {
  if (!directUrl) return "";
  const base = "https://docs.google.com/viewer";
  return `${base}?url=${encodeURIComponent(directUrl)}${embedded ? "&embedded=true" : ""}`;
}

export function getOfficeOnlineViewerUrl(directUrl: string, embedded = false): string {
  if (!directUrl) return "";
  const endpoint = embedded ? "embed.aspx" : "view.aspx";
  return `https://view.officeapps.live.com/op/${endpoint}?src=${encodeURIComponent(directUrl)}`;
}

/**
 * Resolves a direct, publicly accessible Supabase signed URL so Google Docs and Office Online
 * can fetch and render the document without needing browser session cookies.
 */
export async function resolveDirectSignedUrl({
  storagePath,
  submissionId,
  currentUrl,
}: OnlineViewerOptions): Promise<string | null> {
  // 1. If we have storagePath, call /api/storage/download with json=true
  if (storagePath) {
    try {
      const res = await fetch(
        `/api/storage/download?path=${encodeURIComponent(storagePath)}&json=true`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.signedUrl || data.url) {
          return data.signedUrl || data.url;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch signed URL via storage path:", err);
    }
  }

  // 2. If we have submissionId, call /api/faculty/submissions/view with json=true
  if (submissionId) {
    try {
      const res = await fetch(
        `/api/faculty/submissions/view?submissionId=${encodeURIComponent(submissionId)}&json=true`,
        { cache: "no-store" }
      );
      if (res.ok) {
        const data = await res.json();
        if (data.downloadUrl || data.signedUrl) {
          return data.downloadUrl || data.signedUrl;
        }
      }
    } catch (err) {
      console.warn("Failed to fetch signed URL via submissionId:", err);
    }
  }

  // 3. If currentUrl is already an absolute HTTP/HTTPS URL and not an internal /api path
  if (currentUrl && /^https?:\/\//i.test(currentUrl) && !currentUrl.includes("/api/")) {
    return currentUrl;
  }

  // 4. Fallback to currentUrl
  if (currentUrl) {
    if (typeof window !== "undefined" && currentUrl.startsWith("/")) {
      return `${window.location.origin}${currentUrl}`;
    }
    return currentUrl;
  }

  return null;
}

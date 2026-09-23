"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Eye,
  NavArrowLeft,
  OpenNewWindow,
  SystemRestart,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import {
  getGoogleDocsViewerUrl,
  getOfficeOnlineViewerUrl,
  resolveDirectSignedUrl,
} from "@/lib/online-viewers";

export interface OnlineDocumentPreviewProps {
  fileName: string;
  fileUrl: string;
  storagePath?: string | null;
  submissionId?: string | null;
  fileExtension: string;
  isExcel?: boolean;
  isWord?: boolean;
  isPpt?: boolean;
  brand: {
    label: string;
    iconUrl: string;
    borderColor: string;
    badgeBg: string;
    googleApp?: string | null;
    googleAction?: string | null;
    officeApp?: string | null;
    officeAction?: string | null;
  };
  onDownload?: () => void;
}

export function OnlineDocumentPreview({
  fileName,
  fileUrl,
  storagePath,
  submissionId,
  fileExtension,
  isExcel,
  isWord,
  isPpt,
  brand,
  onDownload,
}: OnlineDocumentPreviewProps) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(true);
  const [viewerMode, setViewerMode] = useState<"options" | "google" | "office">("options");
  const [iframeLoading, setIframeLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    setIsResolving(true);

    resolveDirectSignedUrl({
      storagePath,
      submissionId,
      currentUrl: fileUrl,
    })
      .then((resolved) => {
        if (isMounted && resolved) {
          setDirectUrl(resolved);
        }
      })
      .finally(() => {
        if (isMounted) setIsResolving(false);
      });

    return () => {
      isMounted = false;
    };
  }, [storagePath, submissionId, fileUrl]);

  const effectiveUrl =
    directUrl ||
    (typeof window !== "undefined" && fileUrl.startsWith("/")
      ? `${window.location.origin}${fileUrl}`
      : fileUrl);

  const googleViewerUrl = getGoogleDocsViewerUrl(effectiveUrl, false);
  const googleEmbedUrl = getGoogleDocsViewerUrl(effectiveUrl, true);
  const officeViewerUrl = getOfficeOnlineViewerUrl(effectiveUrl, false);
  const officeEmbedUrl = getOfficeOnlineViewerUrl(effectiveUrl, true);

  const ext = (fileExtension || "").toLowerCase();
  const detectedIsExcel = Boolean(isExcel || ["xlsx", "xls", "csv"].includes(ext));
  const detectedIsWord = Boolean(isWord || ["docx", "doc"].includes(ext));
  const detectedIsPpt = Boolean(isPpt || ["pptx", "ppt"].includes(ext));

  // Official Google Workspace Vector SVG Icons
  const googleAppIcon = detectedIsWord
    ? "/icons/google-docs.svg"
    : detectedIsExcel
    ? "/icons/google-sheets.svg"
    : detectedIsPpt
    ? "/icons/google-slides.svg"
    : "/icons/google-drive.svg";

  const googleAppName = detectedIsWord
    ? "Google Docs"
    : detectedIsExcel
    ? "Google Sheets"
    : detectedIsPpt
    ? "Google Slides"
    : "Google Drive";

  // Official Microsoft 365 Vector SVG Icons
  const officeAppIcon = detectedIsWord
    ? "/icons/microsoft-word.svg"
    : detectedIsExcel
    ? "/icons/microsoft-excel.svg"
    : detectedIsPpt
    ? "/icons/microsoft-powerpoint.svg"
    : "/icons/microsoft-office.svg";

  const officeAppName = detectedIsWord
    ? "Word Online"
    : detectedIsExcel
    ? "Excel Online"
    : detectedIsPpt
    ? "PowerPoint Online"
    : "Office Online";

  const rawName = fileName || "";
  const cleanBaseName = rawName.includes("/") ? rawName.split("/").pop() || rawName : rawName;
  const isRawUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(cleanBaseName);
  const displayName = isRawUuid
    ? `${brand.label} (${ext.toUpperCase()})`
    : cleanBaseName || brand.label;

  // When in embedded viewer mode (if user clicks "Show Online Preview")
  if (viewerMode === "google" || viewerMode === "office") {
    const isGoogle = viewerMode === "google";
    const currentEmbedSrc = isGoogle ? googleEmbedUrl : officeEmbedUrl;
    const currentExternalUrl = isGoogle ? googleViewerUrl : officeViewerUrl;

    return (
      <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[500px] lg:min-h-[580px]">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xs text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewerMode("options")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-xs font-semibold shadow-2xs active:scale-95"
            >
              <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
              <span>Back to Options</span>
            </button>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[200px] hidden sm:inline">
              {displayName}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Toggle between Google & Office */}
            <button
              type="button"
              onClick={() => {
                setIframeLoading(true);
                setViewerMode(isGoogle ? "office" : "google");
              }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-750 text-slate-300 transition cursor-pointer text-[11px]"
              title={isGoogle ? `Switch to ${officeAppName}` : `Switch to ${googleAppName}`}
            >
              <img
                src={isGoogle ? officeAppIcon : googleAppIcon}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>{isGoogle ? `Switch to ${officeAppName}` : `Switch to ${googleAppName}`}</span>
            </button>

            {/* Open in external tab */}
            <a
              href={currentExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-750 text-slate-200 transition cursor-pointer font-medium text-[11px] shadow-2xs"
            >
              <img
                src={isGoogle ? googleAppIcon : officeAppIcon}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>Open in New Tab</span>
              <AppIcon icon={OpenNewWindow} size="xs" color="inherit" className="ml-0.5" />
            </a>
          </div>
        </div>

        {/* Embedded Iframe Container */}
        <div className="relative flex-1 w-full bg-slate-950 flex flex-col">
          {(iframeLoading || isResolving) ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs z-10 gap-3">
              <div className="p-3 rounded-2xl bg-slate-900 border border-slate-800 shadow-md flex items-center justify-center">
                <img
                  src={isGoogle ? googleAppIcon : officeAppIcon}
                  alt=""
                  className="w-8 h-8 object-contain animate-pulse"
                />
              </div>
              <span className="text-xs font-semibold text-slate-300 flex items-center gap-2">
                <AppIcon icon={SystemRestart} size="sm" color="active" className="animate-spin" />
                <span>Loading {isGoogle ? googleAppName : officeAppName} Preview...</span>
              </span>
            </div>
          ) : null}
          <iframe
            key={currentEmbedSrc}
            src={currentEmbedSrc}
            title={`${displayName} Online Preview`}
            className="w-full h-full flex-1 border-0 rounded-b-2xl bg-white"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  }

  // Default: Simple, clean card matching user request with official icons
  return (
    <div className="flex flex-col items-center justify-center h-full w-full max-w-lg mx-auto p-6 sm:p-8 text-center bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xs transition-all my-auto">
      {/* File Brand Icon Badge (Using official Microsoft / Office App Icon) */}
      <div className="relative p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 mb-3.5 shadow-2xs border border-slate-200 dark:border-slate-700/60 flex items-center justify-center">
        <img
          src={officeAppIcon}
          alt={brand.label}
          className="w-14 h-14 object-contain select-none drop-shadow-xs"
        />
        <span className="absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 shadow-xs border border-slate-700 dark:border-slate-600">
          {ext.toUpperCase()}
        </span>
      </div>

      <h4 className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1.5 max-w-sm truncate" title={displayName}>
        {displayName}
      </h4>

      <p className="text-xs text-slate-600 dark:text-slate-400 mb-6 max-w-md leading-relaxed">
        Direct browser preview is not supported for{" "}
        <strong className="font-bold text-slate-800 dark:text-slate-200">
          {brand.label}
        </strong>
        . You can open and view it online with Google Drive or Microsoft Office without downloading, or save it to your device.
      </p>

      {/* Online Viewer Action Cards */}
      <div className="w-full space-y-3 max-w-md text-left">
        {/* Option 1: Google Sheets / Docs / Slides */}
        <a
          href={googleViewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-pointer shadow-xs active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="shrink-0 w-11 h-11 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img
                src={googleAppIcon}
                alt={googleAppName}
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white transition-colors block">
                Open in {googleAppName} (Drive)
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                View &amp; import directly into {googleAppName} online
              </p>
            </div>
          </div>
          <AppIcon
            icon={OpenNewWindow}
            size="md"
            color="muted"
            className="shrink-0 ml-2 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors"
          />
        </a>

        {/* Option 2: Microsoft Office Online */}
        <a
          href={officeViewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 transition-all group cursor-pointer shadow-xs active:scale-[0.99]"
        >
          <div className="flex items-center gap-3.5 min-w-0">
            <div className="shrink-0 w-11 h-11 p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img
                src={officeAppIcon}
                alt={officeAppName}
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="min-w-0">
              <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white transition-colors block">
                Open in {officeAppName}
              </span>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                Render with official Microsoft 365 web fidelity
              </p>
            </div>
          </div>
          <AppIcon
            icon={OpenNewWindow}
            size="md"
            color="muted"
            className="shrink-0 ml-2 group-hover:text-slate-900 dark:group-hover:text-slate-100 transition-colors"
          />
        </a>

        {/* Bottom Action Row: Show Online Preview & Download File */}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <button
            type="button"
            onClick={() => {
              setIframeLoading(true);
              setViewerMode("google");
            }}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
          >
            <AppIcon icon={Eye} size="sm" color="default" />
            <span>Show Online Preview</span>
          </button>

          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
            >
              <AppIcon icon={Download} size="sm" color="default" />
              <span>Download File</span>
            </button>
          ) : (
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
            >
              <AppIcon icon={Download} size="sm" color="default" />
              <span>Download File</span>
            </a>
          )}
        </div>
      </div>

      {isResolving ? (
        <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-3 text-center italic animate-pulse">
          Connecting to online cloud viewers...
        </p>
      ) : null}
    </div>
  );
}

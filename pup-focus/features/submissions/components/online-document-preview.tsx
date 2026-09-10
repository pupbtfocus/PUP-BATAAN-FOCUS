"use client";

import { useState, useEffect } from "react";
import {
  Download,
  Eye,
  NavArrowLeft,
  OpenNewWindow,
  SystemRestart,
} from "iconoir-react";
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
  brand,
  onDownload,
}: OnlineDocumentPreviewProps) {
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [viewerMode, setViewerMode] = useState<"options" | "google" | "office">("options");
  const [iframeLoading, setIframeLoading] = useState(false);

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

  const googleActionLabel =
    brand.googleAction ||
    (isExcel
      ? "Open in Google Sheets (Drive)"
      : isWord
      ? "Open in Google Docs (Drive)"
      : "Open in Google Drive");

  const officeActionLabel =
    brand.officeAction ||
    (isExcel
      ? "Open in Excel Online"
      : isWord
      ? "Open in Word Online"
      : "Open in Office Online");

  // When in embedded viewer mode (Google or Office)
  if (viewerMode === "google" || viewerMode === "office") {
    const isGoogle = viewerMode === "google";
    const currentEmbedSrc = isGoogle ? googleEmbedUrl : officeEmbedUrl;
    const currentExternalUrl = isGoogle ? googleViewerUrl : officeViewerUrl;

    return (
      <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xs text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewerMode("options")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-xs font-semibold"
            >
              <NavArrowLeft className="w-3.5 h-3.5" />
              <span>Options</span>
            </button>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[180px] hidden sm:inline">
              {fileName}
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
              title={isGoogle ? "Switch to Microsoft Office Online" : "Switch to Google Docs Viewer"}
            >
              <img
                src={isGoogle ? "/icons/microsoft-office.svg" : "/icons/google-drive.svg"}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>{isGoogle ? "Switch to Office" : "Switch to Drive"}</span>
            </button>

            {/* Open in external tab */}
            <a
              href={currentExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 transition cursor-pointer font-semibold text-[11px]"
              title="Open full page in new tab"
            >
              <img
                src={isGoogle ? "/icons/google-drive.svg" : "/icons/microsoft-office.svg"}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span>{isGoogle ? "Google Drive" : "Office Online"}</span>
              <OpenNewWindow className="w-3 h-3 ml-0.5 opacity-70" />
            </a>

            {/* Download */}
            {onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-[11px]"
                title="Download local copy"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </button>
            ) : (
              <a
                href={fileUrl}
                download={fileName}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-[11px]"
                title="Download local copy"
              >
                <Download className="w-3 h-3" />
                <span>Download</span>
              </a>
            )}
          </div>
        </div>

        {/* Embedded Iframe Container */}
        <div className="relative flex-1 w-full bg-slate-950">
          {iframeLoading ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/85 backdrop-blur-xs z-10 gap-2.5">
              <div className="p-2 rounded-xl bg-slate-900 border border-slate-800 shadow-md">
                <img
                  src={isGoogle ? "/icons/google-drive.svg" : "/icons/microsoft-office.svg"}
                  alt=""
                  className="w-7 h-7 object-contain animate-pulse"
                />
              </div>
              <span className="text-xs text-slate-300 flex items-center gap-1.5">
                <SystemRestart className="w-3.5 h-3.5 text-amber-400 animate-spin" />
                Loading {isGoogle ? "Google Drive Viewer" : "Office Online"}...
              </span>
            </div>
          ) : null}
          <iframe
            key={currentEmbedSrc}
            src={currentEmbedSrc}
            title={`${fileName} Online Preview`}
            className="w-full h-full border-0 rounded-b-2xl"
            onLoad={() => setIframeLoading(false)}
          />
        </div>
      </div>
    );
  }

  // Default Options Card
  return (
    <div
      className={`flex flex-col items-center justify-center h-full w-full max-w-xl mx-auto p-6 text-center bg-slate-50/80 dark:bg-slate-900/80 rounded-2xl border ${brand.borderColor} shadow-xs backdrop-blur-xs transition-all`}
    >
      {/* File Brand Icon Badge */}
      <div className="relative p-4 rounded-2xl bg-white/90 dark:bg-slate-800/90 mb-3 shadow-sm ring-1 ring-slate-200 dark:ring-slate-700/60 flex items-center justify-center">
        <img
          src={brand.iconUrl}
          alt={brand.label}
          className="w-12 h-12 object-contain select-none"
          loading="lazy"
        />
        <span
          className={`absolute -bottom-2 -right-2 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider ${brand.badgeBg} shadow-sm`}
        >
          {fileExtension}
        </span>
      </div>

      <h4 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1 max-w-sm truncate" title={fileName}>
        {fileName}
      </h4>

      <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 max-w-md leading-relaxed">
        Direct browser preview is not supported for{" "}
        <span className="font-bold text-slate-800 dark:text-slate-200">
          {brand.label}
        </span>
        . You can open and view it online with Google Drive or Microsoft Office without downloading, or save it to your device.
      </p>

      {/* Online Viewer Action Cards */}
      <div className="w-full space-y-2.5 max-w-md text-left">
        {/* Option 1: Google Sheets / Google Docs (Drive) */}
        <a
          href={googleViewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl border border-emerald-500/25 bg-emerald-50/60 hover:bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-950/30 dark:hover:bg-emerald-950/50 transition-all group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 p-1.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-emerald-300 dark:ring-emerald-700/60 flex items-center justify-center shadow-xs">
              <img
                src="/icons/google-drive.svg"
                alt="Google Drive"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-emerald-900 dark:text-emerald-300">
                  {googleActionLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-200/60 dark:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300">
                  <img src="/icons/google-drive.svg" alt="" className="w-2.5 h-2.5 object-contain" />
                  Drive
                </span>
              </div>
              <p className="text-[11px] text-emerald-700/80 dark:text-emerald-400/80">
                View &amp; import directly into Google Drive online
              </p>
            </div>
          </div>
          <OpenNewWindow className="w-4 h-4 text-emerald-600 dark:text-emerald-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </a>

        {/* Option 2: Microsoft Office Online */}
        <a
          href={officeViewerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between p-3 rounded-xl border border-sky-500/25 bg-sky-50/60 hover:bg-sky-50 dark:border-sky-500/30 dark:bg-sky-950/30 dark:hover:bg-sky-950/50 transition-all group cursor-pointer shadow-2xs"
        >
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 w-10 h-10 p-1.5 rounded-xl bg-white dark:bg-slate-800 ring-1 ring-sky-300 dark:ring-sky-700/60 flex items-center justify-center shadow-xs">
              <img
                src="/icons/microsoft-office.svg"
                alt="Microsoft Office"
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold text-sky-900 dark:text-sky-300">
                  {officeActionLabel}
                </span>
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-sky-200/60 dark:bg-sky-500/20 text-sky-800 dark:text-sky-300">
                  <img src="/icons/microsoft-office.svg" alt="" className="w-2.5 h-2.5 object-contain" />
                  Office 365
                </span>
              </div>
              <p className="text-[11px] text-sky-700/80 dark:text-sky-400/80">
                Render with official Microsoft 365 web fidelity
              </p>
            </div>
          </div>
          <OpenNewWindow className="w-4 h-4 text-sky-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform shrink-0" />
        </a>

        {/* Action Row: Preview Here (Embedded) & Download */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              setIframeLoading(true);
              setViewerMode("google");
            }}
            className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs"
          >
            <Eye className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-slate-400" />
            <span>Preview in Window</span>
          </button>

          {onDownload ? (
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-slate-400" />
              <span>Download File</span>
            </button>
          ) : (
            <a
              href={fileUrl}
              download={fileName}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white hover:bg-slate-100 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-800 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5 shrink-0 text-slate-600 dark:text-slate-400" />
              <span>Download File</span>
            </a>
          )}
        </div>
      </div>

      {isResolving ? (
        <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 italic animate-pulse">
          Connecting to online cloud viewers...
        </p>
      ) : null}
    </div>
  );
}

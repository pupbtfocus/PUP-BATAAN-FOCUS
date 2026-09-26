"use client";

import { useState, useEffect } from "react";
import JSZip from "jszip";
import {
  Download,
  Eye,
  NavArrowLeft,
  OpenNewWindow,
  Page,
  SystemRestart,
} from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import {
  getGoogleDocsViewerUrl,
  getOfficeOnlineViewerUrl,
  resolveDirectSignedUrl,
} from "@/lib/online-viewers";
import { SystemLoadingScreen } from "@/components/shared/system-loading-screen";

async function extractDocxParagraphs(url: string): Promise<string[] | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const zip = await JSZip.loadAsync(blob);
    const xml = await zip.file("word/document.xml")?.async("string");
    if (!xml) return null;
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml, "application/xml");
    const pElements = doc.getElementsByTagName("w:p");
    const paragraphs: string[] = [];
    for (let i = 0; i < pElements.length; i++) {
      const p = pElements[i];
      const tElements = p.getElementsByTagName("w:t");
      let line = "";
      for (let j = 0; j < tElements.length; j++) {
        line += tElements[j].textContent || "";
      }
      if (line.trim()) {
        paragraphs.push(line.trim());
      }
    }
    return paragraphs;
  } catch (err) {
    console.warn("Failed to extract docx paragraphs:", err);
    return null;
  }
}

async function extractTextFileLines(url: string): Promise<string[] | null> {
  try {
    const res = await fetch(url);
    const text = await res.text();
    return text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  } catch (err) {
    return null;
  }
}

async function extractXlsxData(url: string): Promise<string[] | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const zip = await JSZip.loadAsync(blob);

    // Read shared strings table
    const sharedStrings: string[] = [];
    const ssXml = await zip.file("xl/sharedStrings.xml")?.async("string");
    if (ssXml) {
      const parser = new DOMParser();
      const ssDoc = parser.parseFromString(ssXml, "application/xml");
      const siEls = ssDoc.getElementsByTagName("si");
      for (let i = 0; i < siEls.length; i++) {
        const tEls = siEls[i].getElementsByTagName("t");
        let text = "";
        for (let j = 0; j < tEls.length; j++) text += tEls[j].textContent || "";
        sharedStrings.push(text);
      }
    }

    // Read first worksheet
    const sheetXml = await zip.file("xl/worksheets/sheet1.xml")?.async("string");
    if (!sheetXml) return null;

    const parser = new DOMParser();
    const sheetDoc = parser.parseFromString(sheetXml, "application/xml");
    const rowEls = sheetDoc.getElementsByTagName("row");
    const rows: string[] = [];

    for (let i = 0; i < rowEls.length && i < 200; i++) {
      const cellEls = rowEls[i].getElementsByTagName("c");
      const cells: string[] = [];
      for (let j = 0; j < cellEls.length; j++) {
        const cell = cellEls[j];
        const type = cell.getAttribute("t");
        const vEl = cell.getElementsByTagName("v")[0];
        let value = vEl?.textContent?.trim() || "";
        if (type === "s" && sharedStrings.length > 0) {
          value = sharedStrings[parseInt(value)] ?? value;
        } else if (type === "b") {
          value = value === "1" ? "TRUE" : "FALSE";
        }
        cells.push(value);
      }
      if (cells.some((c) => c.trim())) {
        rows.push(cells.join("  |  "));
      }
    }

    return rows.length > 0 ? rows : null;
  } catch (err) {
    console.warn("Failed to extract xlsx data:", err);
    return null;
  }
}

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
  const [viewerMode, setViewerMode] = useState<"options" | "google" | "office" | "local_doc">("options");
  const [iframeLoading, setIframeLoading] = useState(true);
  const [localContent, setLocalContent] = useState<string[] | null>(null);
  const [isLoadingLocalContent, setIsLoadingLocalContent] = useState(false);

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
      <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[360px] sm:min-h-[460px] lg:min-h-[560px]">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xs text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewerMode("options")}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-xs font-semibold shadow-2xs active:scale-95"
            >
              <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
              <span>Back</span>
            </button>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline">
              {displayName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Toggle between Google & Office */}
            <button
              type="button"
              onClick={() => {
                setIframeLoading(true);
                setViewerMode(isGoogle ? "office" : "google");
              }}
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700/80 bg-slate-800/60 hover:bg-slate-750 text-slate-300 transition cursor-pointer text-[11px]"
              title={isGoogle ? `Switch to ${officeAppName}` : `Switch to ${googleAppName}`}
            >
              <img
                src={isGoogle ? officeAppIcon : googleAppIcon}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span className="hidden sm:inline">{isGoogle ? `Switch to ${officeAppName}` : `Switch to ${googleAppName}`}</span>
              <span className="sm:hidden">{isGoogle ? "Office" : "Google"}</span>
            </button>

            {/* Open in external tab */}
            <a
              href={currentExternalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg border border-slate-700 bg-slate-800/90 hover:bg-slate-750 text-slate-200 transition cursor-pointer font-medium text-[11px] shadow-2xs"
            >
              <img
                src={isGoogle ? googleAppIcon : officeAppIcon}
                alt=""
                className="w-3.5 h-3.5 object-contain shrink-0"
              />
              <span className="hidden sm:inline">Open in New Tab</span>
              <span className="sm:hidden">Open</span>
              <AppIcon icon={OpenNewWindow} size="xs" color="inherit" className="ml-0.5" />
            </a>
          </div>
        </div>

        {/* Embedded Iframe Container */}
        <div className="relative flex-1 w-full bg-slate-950 flex flex-col">
          {(iframeLoading || isResolving) ? (
            <div className="absolute inset-0 z-20">
              <SystemLoadingScreen
                fullScreen={false}
                className="h-full min-h-0 rounded-b-2xl"
                text={`Loading ${isGoogle ? googleAppName : officeAppName} Preview...`}
                subtitle={displayName}
              />
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

  // Local document reader mode (for blob: URLs that cloud viewers can't fetch)
  if (viewerMode === "local_doc") {
    return (
      <div className="flex flex-col h-full w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-800 shadow-xl min-h-[360px] sm:min-h-[460px] lg:min-h-[560px]">
        {/* Top Control Bar */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 sm:px-3.5 sm:py-2.5 bg-slate-950/90 border-b border-slate-800/80 backdrop-blur-xs text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setViewerMode("options")}
              className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl border border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer text-xs font-semibold shadow-2xs active:scale-95"
            >
              <AppIcon icon={NavArrowLeft} size="sm" color="inherit" />
              <span>Back</span>
            </button>
            <span className="text-slate-400 font-mono text-[11px] truncate max-w-[120px] sm:max-w-[200px] hidden sm:inline">
              {displayName}
            </span>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-900/40 border border-amber-700/50 text-amber-300 text-[11px] font-semibold">
            <AppIcon icon={Page} size="xs" color="inherit" />
            Document Reader
          </span>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-950">
          {isLoadingLocalContent ? (
            <div className="flex items-center justify-center h-full py-16">
              <SystemLoadingScreen
                fullScreen={false}
                className="h-full min-h-0 rounded-b-2xl"
                text="Reading document content..."
                subtitle={displayName}
              />
            </div>
          ) : localContent && localContent.length > 0 ? (
            <>
              {detectedIsExcel && (
                <div className="mb-3 px-3 py-2 rounded-lg bg-emerald-950/40 border border-emerald-800/50 text-emerald-400 text-[11px] font-mono">
                  Spreadsheet data — columns separated by <span className="font-bold text-emerald-300"> | </span> · {localContent.length} rows
                </div>
              )}
              <div className={detectedIsExcel ? "space-y-0.5" : "space-y-2"}>
                {localContent.map((line, i) =>
                  detectedIsExcel ? (
                    <div
                      key={i}
                      className={`px-3 py-1.5 rounded text-[12px] font-mono text-slate-200 leading-snug whitespace-pre-wrap break-all ${
                        i === 0
                          ? "bg-slate-800 text-emerald-300 font-bold border border-emerald-900/50"
                          : i % 2 === 0
                          ? "bg-slate-900"
                          : "bg-slate-950"
                      }`}
                    >
                      {line}
                    </div>
                  ) : (
                    <p key={i} className="text-slate-200 text-[13px] leading-relaxed">
                      {line}
                    </p>
                  )
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center gap-3">
              <AppIcon icon={Page} size="xl" color="muted" />
              <p className="text-slate-400 text-sm">
                Could not extract readable content from this file.
              </p>
              <p className="text-slate-500 text-xs max-w-xs">
                The file may be encrypted, binary, or use a format not supported by the client-side reader.
              </p>
            </div>
          )}
        </div>

      </div>
    );
  }

  // Detect if this is a local blob (upload draft) — cloud viewers cannot fetch these
  const isBlob = Boolean(
    effectiveUrl.startsWith("blob:") ||
    fileUrl.startsWith("blob:") ||
    effectiveUrl.startsWith("data:") ||
    fileUrl.startsWith("data:")
  );

  // Default: Simple, clean card matching user request with official icons
  return (
    <div className="flex flex-col items-center justify-center w-full max-w-lg mx-auto p-4 sm:p-6 lg:p-7 text-center bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm backdrop-blur-xs transition-all">
      {/* File Brand Icon Badge (Using official Microsoft / Office App Icon) */}
      <div className="relative p-2.5 sm:p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/80 mb-2.5 sm:mb-3.5 shadow-2xs border border-slate-200 dark:border-slate-700/60 flex items-center justify-center">
        <img
          src={officeAppIcon}
          alt={brand.label}
          className="w-12 h-12 sm:w-14 sm:h-14 object-contain select-none drop-shadow-xs"
        />
        <span className="absolute -bottom-1.5 -right-1.5 px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-slate-900 text-white dark:bg-slate-800 dark:text-slate-100 shadow-xs border border-slate-700 dark:border-slate-600">
          {ext.toUpperCase()}
        </span>
      </div>

      <h4 className="text-sm sm:text-base lg:text-lg font-bold text-slate-900 dark:text-slate-100 mb-1 max-w-sm truncate px-1" title={displayName}>
        {displayName}
      </h4>

      <p className="text-xs text-slate-600 dark:text-slate-400 mb-3.5 sm:mb-5 max-w-md leading-relaxed px-1">
        {isBlob ? (
          <>
            This file is <strong className="font-bold text-slate-800 dark:text-slate-200">selected but not yet uploaded</strong>. Cloud viewers become available after uploading. You can preview the document content directly below.
          </>
        ) : (
          <>
            Direct browser preview is not supported for{" "}
            <strong className="font-bold text-slate-800 dark:text-slate-200">
              {brand.label}
            </strong>
            . You can open and view it online with Google Drive or Microsoft Office without downloading, or save it to your device.
          </>
        )}
      </p>

      {/* Online Viewer Action Cards */}
      <div className="w-full space-y-2.5 sm:space-y-3 max-w-md text-left">
        {/* Option 1: Google Sheets / Docs / Slides */}
        <a
          href={isBlob ? undefined : googleViewerUrl}
          onClick={isBlob ? (e) => e.preventDefault() : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${
            isBlob
              ? "border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed"
              : "border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer active:scale-[0.99]"
          } transition-all group shadow-xs`}
        >
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 p-1.5 sm:p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img
                src={googleAppIcon}
                alt={googleAppName}
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white transition-colors block truncate">
                Open in {googleAppName} (Drive)
              </span>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {isBlob ? "Active once uploaded to cloud" : `View & import directly into ${googleAppName} online`}
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
          href={isBlob ? undefined : officeViewerUrl}
          onClick={isBlob ? (e) => e.preventDefault() : undefined}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex items-center justify-between p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border ${
            isBlob
              ? "border-slate-200/50 dark:border-slate-800/50 bg-slate-50/50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed"
              : "border-slate-200 dark:border-slate-800 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800/80 hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer active:scale-[0.99]"
          } transition-all group shadow-xs`}
        >
          <div className="flex items-center gap-3 sm:gap-3.5 min-w-0">
            <div className="shrink-0 w-10 h-10 sm:w-11 sm:h-11 p-1.5 sm:p-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200/80 dark:border-slate-700/80 flex items-center justify-center shadow-2xs group-hover:scale-105 transition-transform">
              <img
                src={officeAppIcon}
                alt={officeAppName}
                className="w-full h-full object-contain select-none"
              />
            </div>
            <div className="min-w-0">
              <span className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-slate-100 group-hover:text-slate-950 dark:group-hover:text-white transition-colors block truncate">
                Open in {officeAppName}
              </span>
              <p className="text-[11px] sm:text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">
                {isBlob ? "Active once uploaded to cloud" : "Render with official Microsoft 365 web fidelity"}
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

        {/* Bottom Action Row */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 pt-1.5 sm:pt-2">
          {isBlob && (detectedIsWord || detectedIsExcel) ? (
            <button
              type="button"
              onClick={async () => {
                setIsLoadingLocalContent(true);
                setViewerMode("local_doc");
                const url = effectiveUrl.startsWith("blob:") || effectiveUrl.startsWith("data:") ? effectiveUrl : fileUrl;
                let lines: string[] | null = null;
                if (detectedIsWord) {
                  lines = await extractDocxParagraphs(url);
                } else if (detectedIsExcel) {
                  lines = await extractXlsxData(url);
                } else {
                  lines = await extractTextFileLines(url);
                }
                setLocalContent(lines);
                setIsLoadingLocalContent(false);
              }}
              className="col-span-1 sm:col-span-2 flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl border border-[#08412a] bg-[#0b5336] hover:bg-[#08412a] text-white font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
            >
              <AppIcon icon={Eye} size="sm" color="white" />
              <span>Preview Document Content</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setIframeLoading(true);
                setViewerMode("google");
              }}
              className="flex items-center justify-center gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
            >
              <AppIcon icon={Eye} size="sm" color="default" />
              <span>Show Online Preview</span>
            </button>
          )}

          {!isBlob && (
            onDownload ? (
              <button
                type="button"
                onClick={onDownload}
                className="flex items-center justify-center gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
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
                className="flex items-center justify-center gap-2 py-2 sm:py-2.5 px-2.5 sm:px-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white hover:bg-slate-50 dark:bg-slate-800 dark:hover:bg-slate-750 text-slate-700 dark:text-slate-200 font-semibold text-xs transition cursor-pointer shadow-xs active:scale-95"
              >
                <AppIcon icon={Download} size="sm" color="default" />
                <span>Download File</span>
              </a>
            )
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

"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Plus, Refresh } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { ModalHeader } from "@/components/ui/modal-header";

const CROP_BOX_SIZE = 280;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 1;
const MAX_ZOOM = 3;

export interface CropTransform {
  zoom: number;
  offset: { x: number; y: number };
}

export interface ProfilePhotoCropModalProps {
  file: File | null;
  initialTransform?: CropTransform | null;
  onCancel: () => void;
  onApply: (croppedFile: File, transform: CropTransform) => void;
}

export function ProfilePhotoCropModal({
  file,
  initialTransform,
  onCancel,
  onApply,
}: ProfilePhotoCropModalProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [zoom, setZoom] = useState<number>(1);
  const [offset, setOffset] = useState<{ x: number; y: number }>({
    x: 0,
    y: 0,
  });
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  const imgRef = useRef<HTMLImageElement | null>(null);
  const dragStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
  } | null>(null);

  useEffect(() => {
    if (!file) {
      setImageUrl(null);
      setNaturalSize(null);
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setLoadError(null);
      setIsApplying(false);
      return;
    }

    const url = URL.createObjectURL(file);
    const restoredZoom = initialTransform
      ? Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, initialTransform.zoom))
      : 1;
    setImageUrl(url);
    setNaturalSize(null);
    setZoom(restoredZoom);
    setOffset(initialTransform?.offset ?? { x: 0, y: 0 });
    setLoadError(null);
    setIsApplying(false);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file, initialTransform]);

  const clampOffset = useCallback(
    (
      rawX: number,
      rawY: number,
      targetZoom: number,
      nw: number,
      nh: number,
    ): { x: number; y: number } => {
      if (nw <= 0 || nh <= 0) return { x: 0, y: 0 };
      const baseScale = Math.max(CROP_BOX_SIZE / nw, CROP_BOX_SIZE / nh);
      const rw = nw * baseScale * targetZoom;
      const rh = nh * baseScale * targetZoom;
      const maxX = Math.max(0, (rw - CROP_BOX_SIZE) / 2);
      const maxY = Math.max(0, (rh - CROP_BOX_SIZE) / 2);
      return {
        x: Math.min(maxX, Math.max(-maxX, rawX)),
        y: Math.min(maxY, Math.max(-maxY, rawY)),
      };
    },
    [],
  );

  const updateZoom = useCallback(
    (nextZoomRaw: number) => {
      const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoomRaw));
      setZoom((prevZoom) => {
        if (naturalSize && prevZoom > 0 && nextZoom !== prevZoom) {
          const ratio = nextZoom / prevZoom;
          setOffset((prevOffset) =>
            clampOffset(
              prevOffset.x * ratio,
              prevOffset.y * ratio,
              nextZoom,
              naturalSize.width,
              naturalSize.height,
            ),
          );
        }
        return nextZoom;
      });
    },
    [naturalSize, clampOffset],
  );

  const handleReset = () => {
    setZoom(1);
    setOffset({ x: 0, y: 0 });
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!naturalSize || isApplying) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragStateRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      originX: offset.x,
      originY: offset.y,
    };
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragStateRef.current;
    if (!drag || drag.pointerId !== e.pointerId || !naturalSize) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    setOffset(
      clampOffset(
        drag.originX + dx,
        drag.originY + dy,
        zoom,
        naturalSize.width,
        naturalSize.height,
      ),
    );
  };

  const handlePointerEnd = (e: React.PointerEvent<HTMLDivElement>) => {
    if (dragStateRef.current?.pointerId === e.pointerId) {
      dragStateRef.current = null;
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    }
  };

  const handleApplyCrop = async () => {
    const imgEl = imgRef.current;
    if (!file || !imgEl || !naturalSize || isApplying) return;

    setIsApplying(true);
    try {
      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_SIZE;
      canvas.height = OUTPUT_SIZE;
      const ctx = canvas.getContext("2d");
      const currentTransform: CropTransform = { zoom, offset };
      if (!ctx) {
        onApply(file, currentTransform);
        return;
      }

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      const baseScale = Math.max(
        CROP_BOX_SIZE / naturalSize.width,
        CROP_BOX_SIZE / naturalSize.height,
      );
      const rw = naturalSize.width * baseScale * zoom;
      const rh = naturalSize.height * baseScale * zoom;
      const drawX = (CROP_BOX_SIZE - rw) / 2 + offset.x;
      const drawY = (CROP_BOX_SIZE - rh) / 2 + offset.y;
      const ratio = OUTPUT_SIZE / CROP_BOX_SIZE;

      ctx.drawImage(
        imgEl,
        drawX * ratio,
        drawY * ratio,
        rw * ratio,
        rh * ratio,
      );

      const mime =
        file.type === "image/png" || file.type === "image/webp"
          ? file.type
          : "image/jpeg";
      const ext =
        mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "jpg";
      const stem =
        file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9._-]/g, "_") ||
        "profile-photo";

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mime, 0.92),
      );
      if (!blob) {
        onApply(file, currentTransform);
        return;
      }

      const croppedFile = new File([blob], `${stem}.${ext}`, {
        type: mime,
        lastModified: Date.now(),
      });
      onApply(croppedFile, currentTransform);
    } finally {
      setIsApplying(false);
    }
  };

  if (!file || !imageUrl) return null;

  const baseScale = naturalSize
    ? Math.max(
        CROP_BOX_SIZE / naturalSize.width,
        CROP_BOX_SIZE / naturalSize.height,
      )
    : 1;
  const renderedW = naturalSize ? naturalSize.width * baseScale * zoom : CROP_BOX_SIZE;
  const renderedH = naturalSize ? naturalSize.height * baseScale * zoom : CROP_BOX_SIZE;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Adjust & Crop Profile Photo"
      className="fixed inset-0 z-[80] h-dvh overflow-hidden overscroll-none flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={() => {
        if (!isApplying) onCancel();
      }}
    >
      <div
        className="fixed inset-0 h-lvh bg-slate-950/80 backdrop-blur-sm touch-none overscroll-none"
        aria-hidden="true"
      />
      <div
        className="relative z-10 w-full max-w-md max-h-[92dvh] flex flex-col rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <ModalHeader
          icon={Camera}
          title="Adjust Profile Photo"
          subtitle="Drag to center face inside the circle"
        />

        <div className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain p-4 sm:p-5 space-y-4">
          {loadError ? (
            <div className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/30 p-4 text-xs text-rose-700 dark:text-rose-300 text-center">
              {loadError}
            </div>
          ) : (
            <>
              <div className="flex justify-center">
                <div
                  style={{ width: CROP_BOX_SIZE, height: CROP_BOX_SIZE }}
                  onPointerDown={handlePointerDown}
                  onPointerMove={handlePointerMove}
                  onPointerUp={handlePointerEnd}
                  onPointerCancel={handlePointerEnd}
                  onWheel={(e) => {
                    e.preventDefault();
                    updateZoom(zoom + (e.deltaY < 0 ? 0.12 : -0.12));
                  }}
                  className="relative overflow-hidden rounded-2xl bg-slate-950 border border-slate-300 dark:border-slate-700 shadow-inner touch-none select-none cursor-grab active:cursor-grabbing"
                >
                  <img
                    ref={imgRef}
                    src={imageUrl}
                    alt="Crop preview"
                    draggable={false}
                    onLoad={(e) => {
                      const el = e.currentTarget;
                      if (el.naturalWidth > 0 && el.naturalHeight > 0) {
                        setNaturalSize({
                          width: el.naturalWidth,
                          height: el.naturalHeight,
                        });
                        if (initialTransform) {
                          const restoredZoom = Math.min(
                            MAX_ZOOM,
                            Math.max(MIN_ZOOM, initialTransform.zoom),
                          );
                          setOffset(
                            clampOffset(
                              initialTransform.offset.x,
                              initialTransform.offset.y,
                              restoredZoom,
                              el.naturalWidth,
                              el.naturalHeight,
                            ),
                          );
                        } else {
                          setOffset({ x: 0, y: 0 });
                        }
                      }
                    }}
                    onError={() =>
                      setLoadError("Unable to load the selected image file.")
                    }
                    style={{
                      position: "absolute",
                      left: "50%",
                      top: "50%",
                      width: renderedW,
                      height: renderedH,
                      maxWidth: "none",
                      maxHeight: "none",
                      transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
                      opacity: naturalSize ? 1 : 0,
                    }}
                    className="pointer-events-none select-none"
                  />

                  {/* Circular avatar mask + subtle face framing ring */}
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-full border-2 border-amber-400 shadow-[0_0_0_9999px_rgba(2,6,23,0.68)]"
                  />
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-6 rounded-full border border-dashed border-white/35"
                  />
                </div>
              </div>

              {/* Zoom & Center Controls */}
              <div className="space-y-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-3">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                  <span>Zoom ({Math.round(zoom * 100)}%)</span>
                  <button
                    type="button"
                    onClick={handleReset}
                    disabled={isApplying || (zoom === 1 && offset.x === 0 && offset.y === 0)}
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100 disabled:opacity-40 cursor-pointer transition"
                  >
                    <AppIcon icon={Refresh} size="xs" color="inherit" />
                    <span>Center</span>
                  </button>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom - 0.15)}
                    disabled={!naturalSize || zoom <= MIN_ZOOM || isApplying}
                    aria-label="Zoom out"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 text-sm font-bold cursor-pointer transition"
                  >
                    &minus;
                  </button>
                  <input
                    type="range"
                    min={MIN_ZOOM}
                    max={MAX_ZOOM}
                    step={0.01}
                    value={zoom}
                    disabled={!naturalSize || isApplying}
                    onChange={(e) => updateZoom(Number(e.target.value))}
                    aria-label="Zoom level"
                    className="flex-1 accent-amber-500 cursor-pointer"
                  />
                  <button
                    type="button"
                    onClick={() => updateZoom(zoom + 0.15)}
                    disabled={!naturalSize || zoom >= MAX_ZOOM || isApplying}
                    aria-label="Zoom in"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-40 cursor-pointer transition"
                  >
                    <AppIcon icon={Plus} size="xs" color="inherit" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="grid grid-cols-2 sm:flex sm:items-center sm:justify-end gap-2.5 px-4 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
          <button
            type="button"
            disabled={isApplying}
            onClick={onCancel}
            className="w-full sm:w-auto px-4 py-2 rounded-xl text-xs font-semibold bg-[#780000] hover:bg-[#5e0000] text-white border border-[#5e0000] shadow-xs transition cursor-pointer disabled:opacity-50 text-center"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!naturalSize || Boolean(loadError) || isApplying}
            onClick={handleApplyCrop}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold shadow-xs transition cursor-pointer disabled:opacity-50"
          >
            <AppIcon icon={Check} size="sm" color="inherit" />
            <span>{isApplying ? "Cropping..." : "Apply Photo"}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

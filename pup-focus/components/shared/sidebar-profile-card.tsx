"use client";

import React, { useEffect, useState } from "react";
import { NavArrowRight } from "iconoir-react";

export interface SidebarProfileCardProps {
  name?: string | null;
  roleTitle: string;
  avatarUrl?: string | null;
  fallbackAvatarSrc?: string;
  initials: string;
  onClick: () => void;
  className?: string;
}

export function SidebarProfileCard({
  name,
  roleTitle,
  avatarUrl,
  fallbackAvatarSrc,
  initials,
  onClick,
  className = "",
}: SidebarProfileCardProps) {
  const [hasAvatarError, setHasAvatarError] = useState(false);

  useEffect(() => {
    setHasAvatarError(false);
  }, [avatarUrl]);

  const displayName = (name || roleTitle || "User").trim();
  const nameSizeClass =
    displayName.length > 28
      ? "text-xs sm:text-sm leading-snug"
      : displayName.length > 18
        ? "text-sm sm:text-[15px] leading-snug"
        : "text-base sm:text-lg leading-snug";

  return (
    <button
      type="button"
      onClick={onClick}
      title="Manage Profile & Settings"
      className={`group relative w-full text-left rounded-2xl bg-gradient-to-b from-[#660000]/95 to-[#480000]/95 hover:from-[#6d0000] hover:to-[#520000] border border-amber-400/25 hover:border-amber-400/50 p-4 sm:p-5 shadow-md transition-all duration-200 cursor-pointer overflow-hidden focus:outline-hidden ${className}`}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-gradient-to-r from-transparent via-amber-400/80 to-transparent"
        aria-hidden="true"
      />

      <div className="flex items-center gap-3.5 min-w-0">
        <div className="relative shrink-0">
          {avatarUrl && !hasAvatarError ? (
            <img
              src={avatarUrl}
              alt={displayName}
              className="h-16 w-16 rounded-2xl object-cover border-2 border-[#480000] ring-2 ring-amber-400/85 shadow-sm group-hover:ring-amber-300 transition-all"
              onError={() => setHasAvatarError(true)}
            />
          ) : fallbackAvatarSrc ? (
            <img
              src={fallbackAvatarSrc}
              alt={displayName}
              className="h-16 w-16 rounded-2xl object-cover border-2 border-[#480000] ring-2 ring-amber-400/85 shadow-sm group-hover:ring-amber-300 transition-all bg-[#5c0000]"
            />
          ) : (
            <div className="h-16 w-16 rounded-2xl bg-amber-500/20 text-amber-200 border-2 border-[#480000] ring-2 ring-amber-400/75 font-extrabold text-lg flex items-center justify-center shadow-sm group-hover:ring-amber-300 transition-all">
              {initials}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-amber-200/80 leading-none">
            Welcome,
          </p>
          <p
            className={`mt-1.5 font-extrabold text-white tracking-tight break-words ${nameSizeClass}`}
            title={displayName}
          >
            {displayName}
          </p>
        </div>
      </div>

      <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between gap-2">
        <span className="inline-flex items-center justify-center rounded-lg bg-amber-400 text-[#480000] px-3 py-1 text-[11px] sm:text-xs font-black uppercase tracking-wider shadow-2xs">
          {roleTitle}
        </span>
        <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-amber-200/80 group-hover:text-amber-200 transition-colors">
          <span>Profile</span>
          <NavArrowRight
            strokeWidth={2.25}
            className="h-4 w-4 transition-transform group-hover:translate-x-0.5"
          />
        </span>
      </div>
    </button>
  );
}

"use client";

import { useEffect } from "react";

/**
 * Renders the animated campus photo background (PUP Bataan campus photos with smooth crossfade)
 * and attaches body.campus-bg for styling consistency.
 */
export function CampusBackground() {
  useEffect(() => {
    document.body.classList.add("campus-bg");
    return () => {
      document.body.classList.remove("campus-bg");
    };
  }, []);

  return (
    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
      <div
        className="absolute -inset-2 bg-cover bg-center scale-105 filter blur-[4px]"
        style={{
          backgroundImage: 'url("/images/attachments/IMG_9399.jpeg")',
          animation: "backgroundFadeA 16s infinite linear",
        }}
      />
      <div
        className="absolute -inset-2 bg-cover bg-center scale-105 filter blur-[4px]"
        style={{
          backgroundImage: 'url("/images/attachments/IMG_9402.jpeg")',
          animation: "backgroundFadeB 16s infinite linear",
        }}
      />
      {/* Soft maroon color wash & gentle depth (keeps image visible) */}
      <div className="absolute inset-0 bg-[#6b0d18]/38" />
      <div className="absolute inset-0 bg-gradient-to-b from-[#2a0408]/45 via-transparent to-[#1c0205]/60" />
      {/* Subtle vignette border around the viewport for cinematic depth */}
      <div className="absolute inset-0 shadow-[inset_0_0_80px_rgba(0,0,0,0.6)]" />
    </div>
  );
}

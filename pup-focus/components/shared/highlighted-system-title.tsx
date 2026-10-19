import React from "react";

export function HighlightedSystemTitle({ className }: { className?: string }) {
  return (
    <span
      className={
        className ??
        "inline-flex items-center justify-center rounded-full bg-[#3b0000]/65 backdrop-blur-[3px] border border-amber-400/35 px-4 py-1 shadow-[0_2px_10px_rgba(0,0,0,0.35)] text-xs sm:text-sm lg:text-[14px] font-semibold tracking-wide text-amber-50/95 leading-snug"
      }
    >
      <span className="text-amber-300 font-extrabold">F</span>aculty&nbsp;
      <span className="text-amber-300 font-extrabold">O</span>nline&nbsp;
      <span className="text-amber-300 font-extrabold">C</span>ompliance&nbsp;&amp;&nbsp;
      <span className="text-amber-300 font-extrabold">U</span>ploading&nbsp;
      <span className="text-amber-300 font-extrabold">S</span>ystem
    </span>
  );
}

import React from "react";

export function HighlightedSystemTitle({ className }: { className?: string }) {
  return (
    <span className={className ?? "text-white font-semibold tracking-normal text-sm sm:text-base lg:text-[17px]"}>
      <span className="text-amber-400 font-black text-[1.15em] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
        F
      </span>
      aculty{" "}
      <span className="text-amber-400 font-black text-[1.15em] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
        O
      </span>
      nline{" "}
      <span className="text-amber-400 font-black text-[1.15em] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
        C
      </span>
      ompliance and{" "}
      <span className="text-amber-400 font-black text-[1.15em] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
        U
      </span>
      ploading{" "}
      <span className="text-amber-400 font-black text-[1.15em] drop-shadow-[0_0_6px_rgba(251,191,36,0.5)]">
        S
      </span>
      ystem
    </span>
  );
}

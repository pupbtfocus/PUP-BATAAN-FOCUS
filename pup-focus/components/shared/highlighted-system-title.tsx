import React from "react";

export function HighlightedSystemTitle({ className }: { className?: string }) {
  return (
    <span className={className ?? "text-slate-800 dark:text-slate-100 font-semibold tracking-normal text-sm sm:text-base lg:text-[17px]"}>
      <span className="text-[#781113] dark:text-amber-400 font-black text-[1.15em]">
        F
      </span>
      aculty{" "}
      <span className="text-[#781113] dark:text-amber-400 font-black text-[1.15em]">
        O
      </span>
      nline{" "}
      <span className="text-[#781113] dark:text-amber-400 font-black text-[1.15em]">
        C
      </span>
      ompliance and{" "}
      <span className="text-[#781113] dark:text-amber-400 font-black text-[1.15em]">
        U
      </span>
      ploading{" "}
      <span className="text-[#781113] dark:text-amber-400 font-black text-[1.15em]">
        S
      </span>
      ystem
    </span>
  );
}

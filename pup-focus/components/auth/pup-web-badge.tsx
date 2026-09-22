"use client";

import Image from "next/image";

export function PupWebBadge() {
  return (
    <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 sm:gap-2.5">
      {/* PUP Official Website Icon Link */}
      <a
        href="https://www.pup.edu.ph"
        target="_blank"
        rel="noopener noreferrer"
        className="group relative h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border-2 border-amber-400/80 bg-gradient-to-b from-[#580000] to-[#2d0000] shadow-lg shadow-black/40 backdrop-blur-md transition-all duration-300 hover:border-amber-300 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer p-1"
        title="PUP Official Website"
        aria-label="PUP Official Website"
      >
        <div className="relative w-full h-full rounded-full overflow-hidden shadow-xs">
          <Image
            src="/icons/pup-seal.png"
            alt="PUP Seal"
            fill
            sizes="36px"
            className="object-cover scale-110 transition-transform duration-200 group-hover:scale-125"
          />
        </div>
        <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[10px] font-medium text-amber-200 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
          PUP Website
        </span>
      </a>
    </div>
  );
}


"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { InfoCircle, OpenNewWindow, Xmark } from "iconoir-react";
import { BrandMark } from "@/components/shared/brand-mark";

export function PupWebBadge() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 sm:gap-2.5">
        {/* 1. FOCUS System Info / About Icon Button */}
        <button
          type="button"
          onClick={() => setIsAboutOpen(true)}
          className="group relative h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border-2 border-amber-400/80 bg-gradient-to-b from-[#580000] to-[#2d0000] shadow-lg shadow-black/40 backdrop-blur-md transition-all duration-300 hover:border-amber-300 hover:scale-105 active:scale-95 text-amber-300 focus:outline-none cursor-pointer"
          title="About PUP FOCUS"
          aria-label="About PUP FOCUS"
        >
          <InfoCircle className="w-4 h-4 sm:w-[18px] sm:h-[18px] transition-transform duration-200 group-hover:scale-110" />
          <span className="pointer-events-none absolute -top-8 right-0 whitespace-nowrap rounded-md bg-black/85 px-2 py-0.5 text-[10px] font-medium text-amber-200 opacity-0 shadow-md backdrop-blur-sm transition-opacity duration-200 group-hover:opacity-100">
            About FOCUS
          </span>
        </button>

        {/* 2. PUP Official Website Icon Link */}
        <a
          href="https://www.pup.edu.ph"
          target="_blank"
          rel="noopener noreferrer"
          className="group relative h-9 w-9 sm:h-10 sm:w-10 rounded-full flex items-center justify-center border-2 border-amber-400/80 bg-gradient-to-b from-[#580000] to-[#2d0000] shadow-lg shadow-black/40 backdrop-blur-md transition-all duration-300 hover:border-amber-300 hover:scale-105 active:scale-95 focus:outline-none cursor-pointer p-1"
          title="PUP Official Website"
          aria-label="PUP Official Website"
        >
          <div className="relative w-full h-full rounded-full overflow-hidden border border-amber-400/60 shadow-xs">
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

      {/* About PUP FOCUS Modal */}
      {isAboutOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setIsAboutOpen(false)}
        >
          <div
            className="relative w-full max-w-sm rounded-3xl border-2 border-amber-400/80 dark:border-amber-500/80 bg-gradient-to-b from-[#580000] via-[#430000] to-[#2d0000] p-6 sm:p-7 text-[#fff8e7] shadow-2xl shadow-black/40 backdrop-blur-xl animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-amber-200/70 hover:text-amber-200 hover:bg-amber-400/10 transition-colors cursor-pointer"
              aria-label="Close modal"
            >
              <Xmark className="w-5 h-5" />
            </button>

            {/* Header with Crest */}
            <div className="flex flex-col items-center text-center pt-1 pb-2">
              <div className="mb-3">
                <BrandMark size={56} />
              </div>
              <h2 className="text-2xl font-extrabold tracking-wider text-amber-200 uppercase">
                PUP FOCUS
              </h2>
              <div className="mx-auto mt-2.5 h-[2px] w-12 rounded-full bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            </div>

            {/* Action Links */}
            <div className="mt-4 flex items-center gap-2.5 pt-4 border-t border-amber-400/30">
              <Link
                href="/about"
                onClick={() => setIsAboutOpen(false)}
                className="flex-1 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 py-2.5 text-center text-xs font-black uppercase text-[#3d0000] tracking-wider transition-all cursor-pointer shadow-md shadow-black/30 active:scale-95"
              >
                Learn More
              </Link>
              <a
                href="https://www.pup.edu.ph"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-amber-500/40 bg-[#2b0000] hover:bg-[#3a0000] hover:border-amber-400 py-2.5 text-center text-xs font-bold text-amber-100 transition-all cursor-pointer shadow-inner active:scale-95"
              >
                <div className="relative h-4 w-4 rounded-full overflow-hidden shrink-0 border border-amber-400/70 shadow-xs">
                  <Image
                    src="/icons/pup-seal.png"
                    alt="PUP Seal"
                    fill
                    sizes="16px"
                    className="object-cover scale-110"
                  />
                </div>
                <span>PUP Website</span>
                <OpenNewWindow className="w-3 h-3 text-amber-400/70" />
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

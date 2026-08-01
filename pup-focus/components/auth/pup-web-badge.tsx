"use client";

import Image from "next/image";

export function PupWebBadge() {
  return (
    <div className="fixed bottom-6 right-6 z-40">
      <a
        href="https://www.pup.edu.ph/"
        target="_blank"
        rel="noopener noreferrer"
        className="group flex items-center rounded-full border border-[rgba(255,215,0,0.2)] bg-gradient-to-b from-[#4d0000]/90 to-[#2a0000]/90 p-1.5 shadow-lg backdrop-blur-md transition-all duration-500 hover:border-[rgba(255,215,0,0.4)] hover:shadow-[0_0_20px_rgba(255,215,0,0.4)] active:scale-95"
        title="Visit PUP Official Website"
      >
        <div className="relative h-[48px] w-[48px] shrink-0 overflow-hidden rounded-full border-2 border-transparent transition-colors duration-500 group-hover:border-[rgba(255,215,0,0.6)]">
          <Image
            src="/icons/pup-seal.png"
            alt="PUP Seal"
            fill
            sizes="48px"
            className="object-cover"
            priority
          />
        </div>
        <div className="overflow-hidden opacity-0 max-w-0 transition-all duration-500 group-hover:max-w-[160px] group-hover:pl-3 group-hover:pr-4 group-hover:opacity-100">
          <span className="whitespace-nowrap text-sm font-semibold tracking-wide text-amber-100/90 transition-colors duration-500 group-hover:text-amber-400">
            PUP Official Website
          </span>
        </div>
      </a>
    </div>
  );
}

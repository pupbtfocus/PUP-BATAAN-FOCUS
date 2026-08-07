"use client";

import { useState } from "react";
import Link from "next/link";
import { Info, X, CheckCircle2 } from "lucide-react";

export function PupWebBadge() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  return (
    <>
      <div className="fixed bottom-3 right-3 sm:bottom-4 sm:right-4 z-40 flex items-center gap-2 sm:gap-3">
        {/* 1. FOCUS System Info / About Icon Button */}
        <button
          type="button"
          onClick={() => setIsAboutOpen(true)}
          className="h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center bg-[#3a080e]/90 hover:bg-[#4a0e17] shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95 text-amber-400 focus:outline-none"
          title="About PUP FOCUS"
          aria-label="About PUP FOCUS"
        >
          <Info className="w-4 h-4 sm:w-5 sm:h-5" />
        </button>

        {/* 2. PUP Official Website Icon Link */}
        <a
          href="https://www.pup.edu.ph"
          target="_blank"
          rel="noopener noreferrer"
          className="h-9 w-9 sm:h-11 sm:w-11 rounded-full flex items-center justify-center bg-[#3a080e]/90 hover:bg-[#4a0e17] shadow-2xl backdrop-blur-md transition-all duration-300 hover:scale-105 active:scale-95"
          title="PUP Official Website"
        >
          <img
            src="/images/pup-seal.png"
            alt="PUP Official Website"
            className="w-5 h-5 sm:w-6 sm:h-6 rounded-full object-cover"
          />
        </a>
      </div>

      {/* About PUP FOCUS Modal */}
      {isAboutOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-3xl border border-amber-500/30 bg-gradient-to-b from-[#4a0e17] via-[#3a080e] to-[#250408] p-6 text-[#fff8e7] shadow-2xl backdrop-blur-xl">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsAboutOpen(false)}
              className="absolute top-4 right-4 rounded-full p-1.5 text-amber-200/70 hover:text-amber-200 hover:bg-amber-500/20 transition-colors"
              aria-label="Close modal"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="mb-4 pr-6">
              <h2 className="text-xl font-extrabold tracking-wider text-amber-300 uppercase">
                PUP FOCUS
              </h2>
              <p className="text-xs font-medium text-amber-100/90 mt-0.5">
                Faculty Online Compliance and Uploading System
              </p>
            </div>

            <div className="my-3 h-[1px] w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

            {/* Body Description */}
            <div className="space-y-3 text-sm text-slate-200/90 leading-relaxed">
              <p>
                <strong>PUP FOCUS</strong> centralizes faculty compliance
                submission, document review, and curriculum monitoring across
                teaching loads for the Polytechnic University of the Philippines
                - Bataan Campus.
              </p>

              <div className="rounded-2xl border border-amber-500/20 bg-black/30 p-3.5 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-amber-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>
                    Centralized Faculty Requirement Submission & Tracking
                  </span>
                </div>
                <div className="flex items-center gap-2 text-amber-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Curriculum & Outcomes Compliance Monitoring</span>
                </div>
                <div className="flex items-center gap-2 text-amber-200">
                  <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0" />
                  <span>Secure Role-Based Institutional Access</span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-amber-500/20">
              <Link
                href="/about"
                onClick={() => setIsAboutOpen(false)}
                className="text-xs font-semibold text-amber-300 hover:text-amber-200 underline underline-offset-4"
              >
                View full page →
              </Link>
              <div className="flex items-center gap-2">
                <a
                  href="https://www.pup.edu.ph"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-500/20 transition-all"
                >
                  <img
                    src="/images/pup-seal.png"
                    alt="PUP"
                    className="w-4 h-4 rounded-full object-cover"
                  />
                  <span>PUP Official Website</span>
                </a>
                <button
                  type="button"
                  onClick={() => setIsAboutOpen(false)}
                  className="rounded-xl bg-amber-500/20 hover:bg-amber-500/30 px-4 py-1.5 text-xs font-bold text-amber-200 transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

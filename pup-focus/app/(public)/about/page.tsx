import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/ui/logo";

export default function AboutPage() {
  return (
    <main className="relative min-h-screen bg-[#1a0104] text-[#fff8e7] px-4 py-10 overflow-hidden flex flex-col justify-between">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(74,14,23,0.5),rgba(26,1,4,1))] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto w-full">
        {/* Navigation Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#3a080e]/90 hover:bg-[#4a0e17] px-4 py-2 text-xs font-bold text-amber-200 transition-all shadow-xl backdrop-blur-md"
          >
            <ArrowLeft className="w-4 h-4 text-amber-400" />
            <span>Back to Login</span>
          </Link>

          <a
            href="https://www.pup.edu.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#3a080e]/90 hover:bg-[#4a0e17] px-5 py-2 text-xs font-bold text-amber-200 transition-all shadow-xl backdrop-blur-md"
          >
            <img
              src="/images/pup-seal.png"
              alt="PUP"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>PUP Official Website</span>
          </a>
        </div>

        {/* Main Hero Card */}
        <div className="rounded-3xl border border-amber-500/30 bg-[#2d0509]/80 p-8 sm:p-12 shadow-2xl backdrop-blur-xl mb-6">
          {/* Top section: Logos side by side on center/left, Title block on right */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center min-h-[220px]">
            {/* Center/Left Logos Container */}
            <div className="md:col-span-7 flex justify-center items-center gap-6 py-4">
              {/* PUP Seal Circle Badge */}
              <div
                className="relative flex items-center justify-center rounded-full bg-[#4d0000] p-1.5 shadow-xl border-2 border-[#FBBF24] shrink-0"
                style={{ width: 130, height: 130 }}
              >
                <img
                  src="/images/pup-seal.png"
                  alt="PUP Seal"
                  className="w-full h-full rounded-full object-cover shrink-0"
                />
              </div>

              {/* PUP FOCUS Logo */}
              <div className="shrink-0 flex items-center justify-center">
                <Logo size={130} className="w-auto mb-0 mx-0" />
              </div>
            </div>

            {/* Right Title Block */}
            <div className="md:col-span-5 flex flex-col justify-center items-start text-left">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-amber-300 uppercase mb-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span>PUP Bataan Campus</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-amber-200 tracking-wider uppercase leading-none mb-3 drop-shadow-[0_2px_8px_rgba(255,215,0,0.3)]">
                ABOUT
                <br />
                PUP
                <br />
                FOCUS
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-amber-300/90 leading-tight max-w-xs">
                Faculty Online Compliance and Uploading System
              </p>
            </div>
          </div>

          <div className="my-6 h-[1px] w-full bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

          {/* Bottom Statement */}
          <p className="text-base sm:text-xl text-slate-100 font-semibold leading-relaxed">
            PUP FOCUS centralizes faculty compliance submission, review, and
            monitoring across curriculum-based teaching loads.
          </p>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
          <div className="rounded-2xl border border-amber-500/20 bg-[#2d0509]/60 p-6 backdrop-blur-md">
            <h3 className="text-base font-bold text-amber-200 mb-2">
              Requirement Submission
            </h3>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Streamlined uploading and tracking of syllabi, instructional
              materials, and academic requirement compliance per term.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-[#2d0509]/60 p-6 backdrop-blur-md">
            <h3 className="text-base font-bold text-amber-200 mb-2">
              Review & Verification
            </h3>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Enables Program Heads and Academic Administrators to efficiently
              evaluate and approve faculty submission packages.
            </p>
          </div>

          <div className="rounded-2xl border border-amber-500/20 bg-[#2d0509]/60 p-6 backdrop-blur-md">
            <h3 className="text-base font-bold text-amber-200 mb-2">
              Curriculum Monitoring
            </h3>
            <p className="text-xs text-slate-300/90 leading-relaxed">
              Ensures institutional alignment with curriculum standards and
              institutional outcomes across all teaching loads.
            </p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-amber-200/50 pt-4 border-t border-amber-500/10 max-w-5xl mx-auto w-full">
        © {new Date().getFullYear()} Polytechnic University of the Philippines -
        Bataan Campus. All rights reserved.
      </footer>
    </main>
  );
}

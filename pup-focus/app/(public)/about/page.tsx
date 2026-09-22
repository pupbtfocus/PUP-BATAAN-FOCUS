import Link from "next/link";
import { ArrowLeft } from "iconoir-react";
import { AppIcon } from "@/components/ui/app-icon";
import { Logo } from "@/components/ui/logo";

export default function AboutPage() {
  return (
    <main className="relative min-h-screen bg-[#1a0104] text-[#fff8e7] px-4 py-10 overflow-hidden flex flex-col justify-between">
      {/* Background radial gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(74,14,23,0.5),rgba(26,1,4,1))] pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto w-full my-auto">
        {/* Navigation Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#3a080e]/90 hover:bg-[#4a0e17] px-4 py-2 text-xs font-bold text-amber-200 transition-all shadow-xl backdrop-blur-md"
          >
            <AppIcon icon={ArrowLeft} size="md" color="active" />
            <span>Back to Login</span>
          </Link>

          <a
            href="https://www.pup.edu.ph"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-[#3a080e]/90 hover:bg-[#4a0e17] px-5 py-2 text-xs font-bold text-amber-200 transition-all shadow-xl backdrop-blur-md"
          >
            <img
              src="/icons/pup-seal.png"
              alt="PUP"
              className="w-5 h-5 rounded-full object-cover"
            />
            <span>PUP Official Website</span>
          </a>
        </div>

        {/* Main Hero Card */}
        <div className="rounded-3xl border-2 border-amber-400 bg-gradient-to-b from-[#820914] via-[#750610] to-[#66030c] p-8 sm:p-12 shadow-[0_20px_50px_rgba(0,0,0,0.45),0_0_30px_rgba(168,23,38,0.25)] backdrop-blur-xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            {/* Center/Left Logos Container */}
            <div className="md:col-span-7 flex justify-center items-center py-2">
              <Logo size={140} />
            </div>

            {/* Title Block */}
            <div className="md:col-span-5 flex flex-col justify-center items-start text-left">
              <div className="flex items-center gap-2 text-[11px] font-bold tracking-widest text-amber-300 uppercase mb-2">
                <span className="h-2 w-2 rounded-full bg-amber-400 shrink-0" />
                <span>Polytechnic University of the Philippines</span>
              </div>
              <h1 className="text-4xl sm:text-5xl font-black text-amber-200 tracking-wider uppercase leading-none mb-3">
                ABOUT
                <br />
                PUP
                <br />
                FOCUS
              </h1>
              <p className="text-xs sm:text-sm font-semibold text-amber-300/90 leading-tight max-w-sm">
                Faculty Online Compliance and Uploading System
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="relative z-10 text-center text-xs text-amber-200/50 pt-4 border-t border-amber-500/10 max-w-5xl mx-auto w-full">
        © {new Date().getFullYear()} Polytechnic University of the Philippines. All rights reserved.
      </footer>
    </main>
  );
}

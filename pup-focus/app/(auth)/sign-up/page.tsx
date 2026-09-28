import { CampusBackground } from "@/components/shared/campus-background";
import { Logo } from "@/components/ui/logo";
import { PupWebBadge } from "@/components/auth/pup-web-badge";
import { SignUpForm } from "@/components/auth/sign-up-form";

export const metadata = {
  title: "Create Account | PUP FOCUS",
  description: "Sign up for PUP Faculty Online Compliance and Uploading System",
};

export default function SignUpPage() {
  return (
    <main className="relative min-h-screen w-full flex flex-col items-center justify-center p-4 text-[#fff8e7] overflow-x-hidden bg-[#1c0406]">
      {/* Background Campus Slideshow */}
      <CampusBackground />

      <div className="relative z-10 w-full max-w-[420px] mx-auto py-6">
        {/* Card Header Curve and Logo */}
        <div className="relative w-full mx-auto drop-shadow-[0_25px_35px_rgba(0,0,0,0.85)]">
          <div className="relative -mb-[1px] z-10">
            <svg
              viewBox="0 0 400 64"
              className="w-full h-auto block pointer-events-none overflow-visible"
            >
              <defs>
                <linearGradient id="signUpTopGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#800000" />
                  <stop offset="100%" stopColor="#680000" />
                </linearGradient>
                <linearGradient id="signUpTopGoldCrest" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#D97706" stopOpacity="0.8" />
                  <stop offset="15%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="35%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="50%" stopColor="#FFFBEB" stopOpacity="1" />
                  <stop offset="65%" stopColor="#FDE68A" stopOpacity="1" />
                  <stop offset="85%" stopColor="#F59E0B" stopOpacity="0.95" />
                  <stop offset="100%" stopColor="#D97706" stopOpacity="0.8" />
                </linearGradient>
              </defs>

              <path
                d="M 0,64 L 0,20 Q 0,0 20,0 L 142,0 C 158,0 162,37 200,37 C 238,37 242,0 258,0 L 380,0 Q 400,0 400,20 L 400,64 Z"
                fill="url(#signUpTopGrad)"
              />
              <path
                d="M 1,20 Q 1,1 20,1 L 142,1 C 158,1 162,37 200,37 C 238,37 242,1 258,1 L 380,1 Q 399,1 399,20"
                fill="none"
                stroke="url(#signUpTopGoldCrest)"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>

            <div className="absolute -top-8 left-1/2 -translate-x-1/2 z-20">
              <Logo size={110} className="mb-0 drop-shadow-[0_10px_20px_rgba(0,0,0,0.9)]" />
            </div>
          </div>

          {/* Card Body */}
          <section className="relative rounded-b-[2rem] border-x-2 border-b-2 border-amber-400/80 bg-gradient-to-b from-[#680000] via-[#5e0000] to-[#4d0000] p-6 sm:p-7 backdrop-blur-xl text-[#fff8e7]">
            <div className="mt-1 mb-5 text-center">
              <h1 className="text-2xl sm:text-3xl font-black tracking-wider text-amber-300 uppercase mb-1 drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                Create Account
              </h1>
              <div className="mx-auto my-2 h-0.5 w-16 rounded-full bg-gradient-to-r from-transparent via-amber-400 to-transparent shadow-[0_0_8px_rgba(251,191,36,0.6)]" />
              <p className="text-amber-100/90 text-xs sm:text-sm font-medium tracking-wide">
                Faculty Online Compliance and Uploading System
              </p>
            </div>

            <SignUpForm />
          </section>
        </div>

        {/* Footer Badge */}
        <div className="mt-6 flex justify-center">
          <PupWebBadge />
        </div>
      </div>
    </main>
  );
}

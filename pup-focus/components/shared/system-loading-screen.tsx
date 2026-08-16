import Image from "next/image";
import loadingAnimation from "@/assets/icons animations/loading.svg";

export interface LoadingScreenProps {
  text?: string;
  fullScreen?: boolean;
}

export function SystemLoadingScreen({
  text = "Loading PUP FOCUS...",
  fullScreen = true,
}: LoadingScreenProps = {}) {
  return (
    <div
      className={
        fullScreen
          ? "fixed inset-0 z-50 flex flex-col items-center justify-center bg-white/85 dark:bg-slate-950/85 backdrop-blur-md transition-all gap-3"
          : "flex flex-col items-center justify-center min-h-[60vh] w-full p-8 transition-all gap-3"
      }
    >
      {/* Exact Login Page Logo Header Replication */}
      <div className="flex items-center justify-center gap-3.5 mb-1">
        {/* PUP Seal Logo Badge */}
        <div className="relative flex items-center justify-center rounded-full bg-[#4d0000] p-1 shadow-lg border-2 border-[#FBBF24] shrink-0 w-12 h-12">
          <Image
            alt="PUP Logo"
            className="w-full h-full rounded-full object-cover shrink-0"
            height={44}
            priority
            src="/images/pup-seal.png"
            width={44}
          />
        </div>

        {/* Vertical Divider */}
        <div className="h-7 w-[1px] bg-slate-300 dark:bg-slate-700 shrink-0" />

        {/* PUP FOCUS Emblem Logo Badge */}
        <div className="relative flex items-center justify-center rounded-full bg-[#4d0000] p-1 shadow-lg border-2 border-[#FBBF24] shrink-0 w-12 h-12">
          <Image
            alt="PUP FOCUS Logo"
            className="w-full h-full rounded-full object-cover shrink-0 scale-[1.12]"
            height={44}
            priority
            src="/icons/pup-focus-emblem-logo.png"
            width={44}
          />
        </div>
      </div>

      {/* Custom SVG Spinner */}
      <Image
        alt="Loading..."
        height={64}
        priority
        src={loadingAnimation}
        width={64}
      />

      {/* Text Label */}
      {text ? (
        <p className="text-xs sm:text-sm font-medium tracking-wide text-slate-600 dark:text-slate-300 animate-pulse">
          {text}
        </p>
      ) : null}
    </div>
  );
}

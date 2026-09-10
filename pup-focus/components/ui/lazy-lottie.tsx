"use client";

import dynamic from "next/dynamic";
import { type ComponentProps } from "react";
import { SystemRestart } from "iconoir-react";
import { cn } from "@/utils/cn";

// Dynamically import lottie-react with SSR disabled to optimize client bundle
const LottieComponent = dynamic(() => import("lottie-react"), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="flex items-center justify-center p-2 text-amber-500/60 dark:text-amber-400/60"
    >
      <SystemRestart className="h-5 w-5 animate-spin" />
    </div>
  ),
});

export type LazyLottieProps = ComponentProps<typeof LottieComponent> & {
  fallbackClassName?: string;
};

export function LazyLottie({
  className,
  fallbackClassName,
  ...props
}: LazyLottieProps) {
  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <LottieComponent {...props} />
    </div>
  );
}

export default LazyLottie;

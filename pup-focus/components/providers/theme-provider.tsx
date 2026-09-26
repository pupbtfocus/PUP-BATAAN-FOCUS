"use client";

import * as React from "react";
import { ThemeProvider as NextThemesProvider } from "next-themes";
import { IconoirProvider } from "iconoir-react";

// Filter out noise from browser extensions (e.g. Bitdefender TrafficLight) mutating DOM before React hydrates
if (typeof window !== "undefined") {
  const originalConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    try {
      const fullText = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return `${arg.message} ${arg.stack || ""}`;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ");

      if (
        fullText.includes("bis_skin_checked") ||
        fullText.includes("bis_register") ||
        fullText.includes("__processed_") ||
        fullText.includes("Encountered a script tag")
      ) {
        return;
      }
    } catch {}
    originalConsoleError.apply(console, args as [any, ...any[]]);
  };

  window.addEventListener(
    "error",
    (event) => {
      const msg = event?.message || "";
      if (
        msg.includes("bis_skin_checked") ||
        msg.includes("bis_register") ||
        msg.includes("__processed_") ||
        msg.includes("Encountered a script tag")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );
}

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <NextThemesProvider {...props}>
      <IconoirProvider iconProps={{ strokeWidth: 2 }}>
        {children}
      </IconoirProvider>
    </NextThemesProvider>
  );
}

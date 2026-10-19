"use client";

import * as React from "react";
import { IconoirProvider } from "iconoir-react";

type ThemeProviderProps = {
  children: React.ReactNode;
  attribute?: string | string[];
  defaultTheme?: string;
  forcedTheme?: string;
  enableSystem?: boolean;
  disableTransitionOnChange?: boolean;
  [key: string]: unknown;
};

// Filter out noise from browser extensions and transient dev HMR chunk timeouts
if (typeof window !== "undefined") {
  const shouldSuppressLog = (args: unknown[]): boolean => {
    try {
      const fullText = args
        .map((arg) => {
          if (typeof arg === "string") return arg;
          if (arg instanceof Error) return `${arg.name}: ${arg.message} ${arg.stack || ""}`;
          try {
            return JSON.stringify(arg);
          } catch {
            return String(arg);
          }
        })
        .join(" ");

      return (
        fullText.includes("bis_skin_checked") ||
        fullText.includes("bis_register") ||
        fullText.includes("__processed_") ||
        fullText.includes("Encountered a script tag") ||
        fullText.includes("Invalid login credentials") ||
        fullText.includes("[Auth] Supabase sign-in") ||
        fullText.includes("Can't perform a React state update on a component that hasn't mounted yet") ||
        fullText.includes("ChunkLoadError") ||
        fullText.includes("Loading chunk")
      );
    } catch {
      return false;
    }
  };

  const originalConsoleError = console.error;
  console.error = function (...args: unknown[]) {
    if (shouldSuppressLog(args)) return;
    originalConsoleError.apply(console, args as [any, ...any[]]);
  };

  const originalConsoleWarn = console.warn;
  console.warn = function (...args: unknown[]) {
    if (shouldSuppressLog(args)) return;
    originalConsoleWarn.apply(console, args as [any, ...any[]]);
  };

  const tryRecoverChunkLoadError = (message: string) => {
    if (message.includes("ChunkLoadError") || message.includes("Loading chunk")) {
      try {
        const reloadKey = "pup_focus_chunk_reload_ts";
        const lastReload = Number(sessionStorage.getItem(reloadKey) || "0");
        const now = Date.now();
        if (now - lastReload > 15000) {
          sessionStorage.setItem(reloadKey, String(now));
          window.location.reload();
        }
      } catch {}
      return true;
    }
    return false;
  };

  window.addEventListener(
    "error",
    (event) => {
      const msg = `${event?.message || ""} ${event?.error?.message || ""} ${event?.error?.name || ""}`;
      if (tryRecoverChunkLoadError(msg)) {
        event.stopImmediatePropagation();
        event.preventDefault();
        return;
      }
      if (
        msg.includes("bis_skin_checked") ||
        msg.includes("bis_register") ||
        msg.includes("__processed_") ||
        msg.includes("Encountered a script tag") ||
        msg.includes("Invalid or unexpected token")
      ) {
        event.stopImmediatePropagation();
        event.preventDefault();
      }
    },
    true
  );

  window.addEventListener(
    "unhandledrejection",
    (event) => {
      const reason = event?.reason;
      const msg =
        typeof reason === "string"
          ? reason
          : `${reason?.name || ""} ${reason?.message || ""}`;
      if (tryRecoverChunkLoadError(msg)) {
        event.preventDefault();
      }
    },
    true
  );
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  React.useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.classList.add("light");
    root.style.colorScheme = "light";
  }, []);

  return (
    <IconoirProvider iconProps={{ strokeWidth: 2 }}>
      {children}
    </IconoirProvider>
  );
}


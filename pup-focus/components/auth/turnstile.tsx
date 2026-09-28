"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TurnstileInstance {
  reset: () => void;
  render?: () => void;
  remove?: () => void;
  getResponse?: () => string | undefined;
}

export interface TurnstileProps {
  siteKey: string;
  onSuccess?: (token: string) => void;
  onError?: (error?: unknown) => void;
  onExpire?: () => void;
  options?: {
    theme?: "light" | "dark" | "auto";
    size?: "normal" | "flexible" | "compact";
    action?: string;
  };
  className?: string;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement | string,
        params: {
          sitekey: string;
          callback?: (token: string) => void;
          "error-callback"?: (error?: unknown) => void;
          "expired-callback"?: () => void;
          theme?: "light" | "dark" | "auto";
          size?: "normal" | "flexible" | "compact";
          action?: string;
        }
      ) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
      getResponse: (widgetId?: string) => string | undefined;
    };
  }
}

export const Turnstile = forwardRef<TurnstileInstance, TurnstileProps>(
  function Turnstile({ siteKey, onSuccess, onError, onExpire, options, className }, ref) {
    const containerRef = useRef<HTMLDivElement>(null);
    const widgetIdRef = useRef<string | null>(null);

    useImperativeHandle(ref, () => ({
      reset: () => {
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch {
            // Ignore reset failures if widget unmounted
          }
        }
      },
      render: () => {},
      remove: () => {
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore removal errors
          }
          widgetIdRef.current = null;
        }
      },
      getResponse: () => {
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          return window.turnstile.getResponse(widgetIdRef.current);
        }
        return undefined;
      },
    }));

    useEffect(() => {
      if (!siteKey || typeof window === "undefined") return;

      let isMounted = true;

      function renderWidget() {
        if (!containerRef.current || !window.turnstile || !isMounted) return;
        if (widgetIdRef.current) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore removal errors
          }
          widgetIdRef.current = null;
        }
        try {
          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted) onSuccess?.(token);
            },
            "error-callback": (err: unknown) => {
              if (isMounted) onError?.(err);
            },
            "expired-callback": () => {
              if (isMounted) onExpire?.();
            },
            theme: options?.theme || "dark",
            size: options?.size || "normal",
            action: options?.action,
          });
        } catch (e) {
          console.error("Turnstile render error:", e);
        }
      }

      if (window.turnstile) {
        renderWidget();
      } else {
        const scriptId = "cf-turnstile-script";
        let script = document.getElementById(scriptId) as HTMLScriptElement | null;
        if (!script) {
          script = document.createElement("script");
          script.id = scriptId;
          script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
          script.async = true;
          script.defer = true;
          script.onload = () => {
            renderWidget();
          };
          document.head.appendChild(script);
        } else {
          script.addEventListener("load", () => {
            renderWidget();
          });
        }
      }

      return () => {
        isMounted = false;
        if (widgetIdRef.current && window.turnstile) {
          try {
            window.turnstile.remove(widgetIdRef.current);
          } catch {
            // Ignore removal errors
          }
          widgetIdRef.current = null;
        }
      };
    }, [siteKey, options?.theme, options?.size, options?.action]);

    return <div ref={containerRef} className={className} />;
  }
);

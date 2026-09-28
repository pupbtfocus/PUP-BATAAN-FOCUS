"use client";

import { useEffect, useRef, useImperativeHandle, forwardRef } from "react";

export interface TurnstileInstance {
  execute: () => void;
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
    size?: "normal" | "flexible" | "compact" | "invisible";
    action?: string;
    execution?: "render" | "execute";
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
          size?: "normal" | "flexible" | "compact" | "invisible";
          action?: string;
          execution?: "render" | "execute";
        }
      ) => string;
      execute: (containerOrWidgetId?: HTMLElement | string) => void;
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
    const isPendingExecuteRef = useRef(false);

    const onSuccessRef = useRef(onSuccess);
    const onErrorRef = useRef(onError);
    const onExpireRef = useRef(onExpire);

    useEffect(() => {
      onSuccessRef.current = onSuccess;
      onErrorRef.current = onError;
      onExpireRef.current = onExpire;
    });

    useImperativeHandle(ref, () => ({
      execute: () => {
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          try {
            // Check if widget already has an unexpired response token
            const existingToken = window.turnstile.getResponse(widgetIdRef.current);
            if (existingToken) {
              console.log("[Turnstile] Using existing response token");
              onSuccessRef.current?.(existingToken);
              return;
            }
            window.turnstile.execute(widgetIdRef.current);
          } catch (e) {
            console.error("[Turnstile] Execute error:", e);
            onErrorRef.current?.(e);
          }
        } else {
          isPendingExecuteRef.current = true;
        }
      },
      reset: () => {
        isPendingExecuteRef.current = false;
        if (typeof window !== "undefined" && window.turnstile && widgetIdRef.current) {
          try {
            window.turnstile.reset(widgetIdRef.current);
          } catch (e) {
            console.warn("[Turnstile] Reset warning:", e);
          }
        }
      },
      render: () => {},
      remove: () => {
        isPendingExecuteRef.current = false;
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
          const effectiveSize = options?.size || "normal";
          const effectiveExecution = options?.execution || "render";

          widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            callback: (token: string) => {
              if (isMounted) {
                console.log("[Turnstile] Challenge completed, token received");
                onSuccessRef.current?.(token);
              }
            },
            "error-callback": (err: unknown) => {
              if (isMounted) {
                console.error("[Turnstile] Challenge error callback:", err);
                onErrorRef.current?.(err);
              }
            },
            "expired-callback": () => {
              if (isMounted) {
                console.warn("[Turnstile] Token expired callback");
                onExpireRef.current?.();
              }
            },
            theme: options?.theme || "dark",
            size: effectiveSize,
            action: options?.action,
            execution: effectiveExecution,
          });

          if (isPendingExecuteRef.current && widgetIdRef.current) {
            isPendingExecuteRef.current = false;
            window.turnstile.execute(widgetIdRef.current);
          }
        } catch (e) {
          console.error("[Turnstile] Render error:", e);
          onErrorRef.current?.(e);
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
          script.onerror = (e) => {
            console.error("[Turnstile] Failed to load Cloudflare Turnstile script:", e);
            onErrorRef.current?.(e);
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
    }, [siteKey, options?.theme, options?.size, options?.action, options?.execution]);

    return <div ref={containerRef} className={className} />;
  }
);

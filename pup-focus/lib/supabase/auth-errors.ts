export function isInvalidRefreshTokenError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as {
    code?: string;
    status?: number;
    message?: string;
    __isAuthError?: boolean;
    name?: string;
  };

  const message = (authError.message || "").toLowerCase();
  const code = (authError.code || "").toLowerCase();

  return (
    code === "refresh_token_not_found" ||
    message.includes("invalid refresh token") ||
    message.includes("refresh token not found") ||
    (authError.__isAuthError === true &&
      authError.status === 400 &&
      (code === "refresh_token_not_found" || message.includes("refresh token")))
  );
}

export function patchRefreshTokenErrorConsoleFilter() {
  if (typeof console === "undefined") {
    return;
  }
  const anyConsole = console as any;
  if (anyConsole.__hasRefreshTokenFilter) {
    return;
  }
  anyConsole.__hasRefreshTokenFilter = true;

  const originalConsoleError = console.error.bind(console);
  const originalConsoleWarn = console.warn.bind(console);
  console.error = (...args: any[]) => {
    if (args.length > 0 && isInvalidRefreshTokenError(args[0])) {
      return;
    }
    if (
      typeof args[0] === "string" &&
      args[0].includes("[Cloudflare Turnstile]")
    ) {
      originalConsoleWarn(...args);
      return;
    }
    if (
      typeof args[0] === "string" &&
      args[0].includes("Can't perform a React state update on a component that hasn't mounted yet")
    ) {
      return;
    }
    originalConsoleError(...args);
  };
}

patchRefreshTokenErrorConsoleFilter();


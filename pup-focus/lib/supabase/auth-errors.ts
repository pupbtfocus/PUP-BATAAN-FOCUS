export function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as {
    code?: string;
    status?: number;
    message?: string;
    __isAuthError?: boolean;
  };

  const message = authError.message?.toLowerCase() ?? "";

  return (
    authError.__isAuthError === true &&
    (authError.code === "refresh_token_not_found" ||
      message.includes("invalid refresh token") ||
      message.includes("refresh token not found") ||
      authError.status === 400)
  );
}

import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/config/env";

function isInvalidRefreshTokenError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const authError = error as {
    code?: string;
    status?: number;
    message?: string;
    __isAuthError?: boolean;
  };

  return (
    authError.__isAuthError === true &&
    (authError.code === "refresh_token_not_found" ||
      authError.message?.includes("Invalid Refresh Token") ||
      authError.status === 400)
  );
}

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (!cookie.name.startsWith("sb-")) {
      return;
    }

    request.cookies.delete(cookie.name);
    response.cookies.delete(cookie.name);
  });
}

export async function updateSupabaseSession(request: NextRequest) {
  const response = NextResponse.next({ request });
  const env = getPublicEnvSafe();

  // Allow local boot even before env variables are configured.
  if (!env) {
    return response;
  }

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    },
  );

  const { error } = await supabase.auth.getUser();

  if (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response);
      return response;
    }

    // Optionally handle other errors, or just log them.
    console.error("Supabase auth error:", error.message);
  }

  return response;
}

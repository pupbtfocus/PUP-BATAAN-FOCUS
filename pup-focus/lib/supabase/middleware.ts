import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/config/env";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export type MiddlewareResult = {
  response: NextResponse;
  user: User | null;
  supabase: SupabaseClient | null;
};

import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-errors";

function clearSupabaseCookies(request: NextRequest, response: NextResponse) {
  request.cookies.getAll().forEach((cookie) => {
    if (!cookie.name.startsWith("sb-")) {
      return;
    }

    request.cookies.delete(cookie.name);
    response.cookies.set(cookie.name, "", {
      path: "/",
      maxAge: 0,
      expires: new Date(0),
    });
  });
}

export async function updateSupabaseSession(
  request: NextRequest,
): Promise<MiddlewareResult> {
  const response = NextResponse.next({ request });
  const env = getPublicEnvSafe();

  // Allow local boot even before env variables are configured.
  if (!env) {
    return { response, user: null, supabase: null };
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

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) {
    if (isInvalidRefreshTokenError(error)) {
      clearSupabaseCookies(request, response);
      return { response, user: null, supabase };
    }

    if (error.message !== "Auth session missing!") {
      console.error("Supabase auth error:", error.message);
    }
  }

  return { response, user: user ?? null, supabase };
}



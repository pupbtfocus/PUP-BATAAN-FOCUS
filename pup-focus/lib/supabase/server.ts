import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { getPublicEnv } from "@/config/env";
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-errors";

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const env = getPublicEnv();

  const client = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    },
  );

  const auth = client.auth as typeof client.auth & { getUser: any };
  const originalGetUser = auth.getUser.bind(client.auth);

  auth.getUser = async (...args: any[]) => {
    try {
      return await originalGetUser(...args);
    } catch (error) {
      if (isInvalidRefreshTokenError(error)) {
        return { data: { user: null }, error: null };
      }

      throw error;
    }
  };

  return client;
}

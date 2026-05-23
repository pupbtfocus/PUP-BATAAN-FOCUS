import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/config/env";

const SUPABASE_ENV_WARNING =
  "Missing NEXT_PUBLIC_SUPABASE_* env vars. Check .env.local before using auth flows.";

function createMissingSupabaseClient() {
  const queryChain: any = new Proxy(function noop() {}, {
    apply() {
      return queryChain;
    },
    get(_target, property) {
      if (property === "then") {
        return (resolve: (value: { data: null; error: null }) => void) => {
          resolve({ data: null, error: null });
        };
      }

      if (property === "catch" || property === "finally") {
        return undefined;
      }

      return queryChain;
    },
  });

  return {
    auth: {
      async getUser() {
        return { data: { user: null }, error: null };
      },
      async signInWithPassword() {
        return {
          data: { user: null, session: null },
          error: new Error(SUPABASE_ENV_WARNING),
        };
      },
      async signOut() {
        return { error: null };
      },
      async updateUser() {
        return {
          data: { user: null },
          error: new Error(SUPABASE_ENV_WARNING),
        };
      },
      async setSession() {
        return {
          data: { session: null },
          error: new Error(SUPABASE_ENV_WARNING),
        };
      },
      async exchangeCodeForSession() {
        return {
          data: { session: null },
          error: new Error(SUPABASE_ENV_WARNING),
        };
      },
      async verifyOtp() {
        return {
          data: { session: null },
          error: new Error(SUPABASE_ENV_WARNING),
        };
      },
    },
    from() {
      return queryChain;
    },
    rpc() {
      return queryChain;
    },
  };
}

export function createClient() {
  const env = getPublicEnvSafe();

  if (!env) {
    // eslint-disable-next-line no-console
    console.warn(SUPABASE_ENV_WARNING);
    return createMissingSupabaseClient() as ReturnType<
      typeof createBrowserClient
    >;
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

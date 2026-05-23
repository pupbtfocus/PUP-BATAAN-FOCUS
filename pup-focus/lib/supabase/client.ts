import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/config/env";

type BrowserSupabaseClient = ReturnType<typeof createBrowserClient>;

type AuthErrorShape = {
  message: string;
  name: "SupabaseAuthError";
  status: number;
  __isAuthError: true;
};

const MISSING_PUBLIC_ENV_MESSAGE =
  "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. Add them to your environment (for local dev, use .env.local).";

let hasWarnedMissingEnv = false;

function buildMissingEnvError(): AuthErrorShape {
  return {
    message: MISSING_PUBLIC_ENV_MESSAGE,
    name: "SupabaseAuthError",
    status: 500,
    __isAuthError: true,
  };
}

function buildMissingEnvClient(): BrowserSupabaseClient {
  const error = buildMissingEnvError();

  return {
    auth: {
      async getUser() {
        return { data: { user: null }, error };
      },
      async signInWithPassword() {
        return { data: { user: null, session: null }, error };
      },
      async signOut() {
        return { error };
      },
      async updateUser() {
        return { data: { user: null }, error };
      },
      async setSession() {
        return { data: { user: null, session: null }, error };
      },
      async exchangeCodeForSession() {
        return { data: { user: null, session: null }, error };
      },
      async verifyOtp() {
        return { data: { user: null, session: null }, error };
      },
    },
  } as unknown as BrowserSupabaseClient;
}

export function createClient() {
  const env = getPublicEnvSafe();

  if (!env) {
    if (!hasWarnedMissingEnv) {
      hasWarnedMissingEnv = true;
      // eslint-disable-next-line no-console
      console.warn(MISSING_PUBLIC_ENV_MESSAGE);
    }

    return buildMissingEnvClient();
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

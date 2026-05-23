import { createBrowserClient } from "@supabase/ssr";
import { getPublicEnvSafe } from "@/config/env";

export function createClient() {
  const env = getPublicEnvSafe();

  if (!env) {
    // In development without envs, avoid throwing during module import.
    // Consumers will likely fail later when making requests; log a warning to aid debugging.
    // eslint-disable-next-line no-console
    console.warn(
      "Missing NEXT_PUBLIC_SUPABASE_* env vars — supabase client created with empty values.",
    );
    return createBrowserClient("", "");
  }

  return createBrowserClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

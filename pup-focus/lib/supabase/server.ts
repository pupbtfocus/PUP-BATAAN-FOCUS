import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import dns from "node:dns";
import { getPublicEnv } from "@/config/env";
import { isInvalidRefreshTokenError } from "@/lib/supabase/auth-errors";

const g = globalThis as typeof globalThis & { __pupFocusUndiciPatched?: boolean };
if (!g.__pupFocusUndiciPatched) {
  g.__pupFocusUndiciPatched = true;
  try {
    dns.setDefaultResultOrder("ipv4first");
    const { Agent, setGlobalDispatcher } = require("undici");
    const agent = new Agent({
      connect: {
        lookup: (hostname: string, opts: any, cb: any) => {
          dns.lookup(hostname, { ...opts, family: 4 }, cb);
        },
      },
    });
    setGlobalDispatcher(agent);
  } catch {}
}

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
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if middleware is refreshing user sessions.
          }
        },
      },
    },
  );

  const auth = client.auth as typeof client.auth & { getUser: any };
  const originalGetUser = auth.getUser.bind(client.auth);

  auth.getUser = async (...args: any[]) => {
    const { data, error } = await originalGetUser(...args);

    if (error) {
      if (isInvalidRefreshTokenError(error)) {
        return { data: { user: null }, error: null };
      }
    }

    return { data, error };
  };

  return client;
}

import { createClient } from "@supabase/supabase-js";
import { getPublicEnv } from "@/config/env";
import { getServiceRoleKey } from "@/config/env";

export function getServiceRoleClient() {
  const env = getPublicEnv();
  const serviceKey = getServiceRoleKey();

  return createClient(env.NEXT_PUBLIC_SUPABASE_URL, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";
import { getPublicEnv } from "@/config/env";
import { getServiceRoleKey } from "@/config/env";

try {
  dns.setDefaultResultOrder("ipv4first");
} catch {}

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

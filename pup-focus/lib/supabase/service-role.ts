import { createClient } from "@supabase/supabase-js";
import dns from "node:dns";
import { getPublicEnv } from "@/config/env";
import { getServiceRoleKey } from "@/config/env";

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

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    try {
      const dns = await import("node:dns");
      dns.setDefaultResultOrder("ipv4first");
    } catch {}

    try {
      const { Agent, setGlobalDispatcher } = await import("undici");
      const dns = await import("node:dns");
      const agent = new Agent({
        connect: {
          lookup: (hostname, opts, cb) => {
            dns.lookup(hostname, { ...opts, family: 4 }, cb);
          },
        },
      });
      setGlobalDispatcher(agent);
    } catch {}
  }
}


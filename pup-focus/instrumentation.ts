export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const g = globalThis as typeof globalThis & {
      __pupFocusUndiciPatched?: boolean;
    };

    if (!g.__pupFocusUndiciPatched) {
      g.__pupFocusUndiciPatched = true;
      try {
        const dns = await import("node:dns");
        dns.setDefaultResultOrder("ipv4first");

        const { Agent, setGlobalDispatcher } = await import("undici");
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
}

export async function onRequestError(
  err: unknown,
  request: {
    path: string;
    method: string;
    headers: Record<string, string | string[] | undefined>;
  },
  context: {
    routerKind: "Pages Router" | "App Router";
    routePath: string;
    routeType: "render" | "route" | "action" | "middleware";
  },
) {
  console.error("[PUP FOCUS Request Error]", {
    path: request.path,
    method: request.method,
    routePath: context.routePath,
    routeType: context.routeType,
    error: err instanceof Error ? { message: err.message, stack: err.stack } : String(err),
  });
}



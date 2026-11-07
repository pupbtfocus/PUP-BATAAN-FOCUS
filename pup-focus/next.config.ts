import type { NextConfig } from "next";
import dns from "node:dns";

// Force IPv4-only lookup to prevent 10s Undici connect timeouts with dead IPv6/NAT64 addresses
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

const cspHeader = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://challenges.cloudflare.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' blob: data: https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://challenges.cloudflare.com",
  "frame-src 'self' https://challenges.cloudflare.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const securityHeaders = [
  {
    key: "Content-Security-Policy",
    value: cspHeader,
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-Frame-Options",
    value: "DENY",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Provide an explicit (empty) turbopack config so Next.js
  // doesn't error when a custom `webpack` function is present.
  turbopack: {},
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "vivhzxlyipalvzqqiibn.supabase.co",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "**.supabase.co",
        pathname: "/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/super-admin/:path*",
        destination: "/admin/:path*",
      },
      {
        source: "/api/super-admin/:path*",
        destination: "/api/admin/:path*",
      },
      {
        source: "/api/admin/faculty/:path*",
        destination: "/api/staff/faculty/:path*",
      },
      {
        source: "/api/admin/submission-window/:path*",
        destination: "/api/staff/submission-window/:path*",
      },
      {
        source: "/api/admin/academic-terms/:path*",
        destination: "/api/staff/academic-terms/:path*",
      },
      {
        source: "/api/admin/requirement-templates/:path*",
        destination: "/api/staff/requirement-templates/:path*",
      },
      {
        source: "/api/admin/notifications/:path*",
        destination: "/api/staff/notifications/:path*",
      },
      {
        source: "/api/admin/dashboard/:path*",
        destination: "/api/staff/dashboard/:path*",
      },
      {
        source: "/api/admin/backups/:path*",
        destination: "/api/staff/backups/:path*",
      },
      {
        source: "/api/admin/audit-logs/:path*",
        destination: "/api/staff/transaction-logs/:path*",
      },
      {
        source: "/api/admin/transaction-logs/:path*",
        destination: "/api/staff/transaction-logs/:path*",
      },
      {
        source: "/api/admin/user-registration-logs/:path*",
        destination: "/api/staff/user-registration-logs/:path*",
      },
    ];
  },
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack filesystem cache to avoid noisy serialization warnings.
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;

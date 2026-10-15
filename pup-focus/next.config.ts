import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_DIST_DIR || ".next",
  // Provide an explicit (empty) turbopack config so Next.js
  // doesn't error when a custom `webpack` function is present.
  turbopack: {},
  outputFileTracingRoot: __dirname,
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
        destination: "/api/staff/audit-logs/:path*",
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

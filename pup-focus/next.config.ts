import type { NextConfig } from "next";

const isVercelBuild = process.env.VERCEL === "1";

const nextConfig: NextConfig = {
  // Provide an explicit (empty) turbopack config so Next.js
  // doesn't error when a custom `webpack` function is present.
  turbopack: {},
  // Vercel's packaging step may read manifests from repository root.
  // Emit build output there during Vercel builds to avoid path mismatches.
  distDir: isVercelBuild ? "../.next" : ".next",
  outputFileTracingRoot: __dirname,
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack filesystem cache to avoid noisy serialization warnings.
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;

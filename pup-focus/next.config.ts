import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Provide an explicit (empty) turbopack config so Next.js
  // doesn't error when a custom `webpack` function is present.
  turbopack: {},
  webpack: (config, { dev }) => {
    if (dev) {
      // Disable webpack filesystem cache to avoid noisy serialization warnings.
      config.cache = false;
    }

    return config;
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  webpack: (config, { dev }) => {
    if (!dev) {
      return config;
    }

    // macOS dev environments can hit EMFILE from file watchers when the repo + deps are large.
    // Polling trades CPU for stability and avoids the dev server silently degrading.
    config.watchOptions = {
      ...(config.watchOptions ?? {}),
      poll: 1000,
      aggregateTimeout: 300,
      ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"]
    };

    return config;
  }
};

export default nextConfig;
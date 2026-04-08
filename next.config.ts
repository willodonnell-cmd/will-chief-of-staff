import type { NextConfig } from "next";

const distDir = process.env.NEXT_DIST_DIR || ".next";
const isVerificationBuild = distDir === ".next-build";

const nextConfig: NextConfig = {
  distDir,
  typedRoutes: !isVerificationBuild,
  typescript: {
    tsconfigPath: isVerificationBuild ? "tsconfig.build.json" : "tsconfig.json"
  }
};

export default nextConfig;

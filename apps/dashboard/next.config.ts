import type { NextConfig } from "next";

const collectorOrigin = (process.env.COLLECTOR_ORIGIN || process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001")
  .replace(/\/+$/, "")

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${collectorOrigin}/:path*`,
      },
    ];
  },
};

export default nextConfig;

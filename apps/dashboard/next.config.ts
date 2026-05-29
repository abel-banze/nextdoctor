import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.COLLECTOR_ORIGIN || "http://localhost:3001"}/:path*`,
      },
    ];
  },
};

export default nextConfig;

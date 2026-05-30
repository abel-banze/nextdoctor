import type { NextConfig } from "next";

const normalizeOrigin = (value?: string) =>
  value?.trim().replace(/\/api\/?$/, "").replace(/\/+$/, "") || ""

const collectorOrigin = normalizeOrigin(
  process.env.COLLECTOR_ORIGIN ||
    process.env.NEXT_PUBLIC_COLLECTOR_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    "http://localhost:3001",
)

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: "/auth/callback/:path*",
          destination: `${collectorOrigin}/auth/callback/:path*`,
        },
      ],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${collectorOrigin}/:path*`,
        },
      ],
    };
  },
};

export default nextConfig;

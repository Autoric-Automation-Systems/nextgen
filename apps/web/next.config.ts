import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nextgen/auth", "@nextgen/core", "@nextgen/db", "@nextgen/integrations"],
  serverExternalPackages: ["@prisma/client", ".prisma/client"],
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;

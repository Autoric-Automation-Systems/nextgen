import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@nextgen/auth", "@nextgen/core", "@nextgen/db", "@nextgen/integrations"],
  serverExternalPackages: ["@prisma/client", ".prisma/client", "nodemailer"],
  // O rastreador de arquivos não segue o link simbólico do pnpm até o engine do
  // Prisma, e a função sobe sem `libquery_engine-*.so.node` (erro só em runtime:
  // "could not locate the Query Engine for runtime"). Estes globs cobrem o caminho
  // com hash do pnpm e a instalação hoisted, se houver.
  outputFileTracingIncludes: {
    "/**/*": [
      "../../node_modules/.pnpm/@prisma+client*/node_modules/.prisma/client/**/*",
      "../../node_modules/.prisma/client/**/*",
      "./node_modules/.prisma/client/**/*",
    ],
  },
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

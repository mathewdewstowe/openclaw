import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {},
  webpack: (config, { isServer }) => {
    if (isServer) {
      config.resolve = config.resolve || {};
      // Add workerd condition so Prisma's WASM loader resolves correctly
      config.resolve.conditionNames = [
        "workerd",
        "worker",
        ...(config.resolve.conditionNames || ["node", "require", "import"]),
      ];
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };
    }

    return config;
  },
  async headers() {
    return [
      {
        // Never cache HTML pages — they reference content-hashed JS/CSS bundles
        // that change on every deploy. Caching HTML causes stale bundle refs.
        source: "/((?!_next/static|_next/image|favicon.ico).*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-store, must-revalidate",
          },
        ],
      },
      {
        // Static assets (content-hashed) can be cached forever
        source: "/_next/static/:path*",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
    ];
  },
};

export default nextConfig;

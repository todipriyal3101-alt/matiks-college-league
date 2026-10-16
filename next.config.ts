import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  // Phase 7: the League Overview at /admin replaces these list pages.
  async redirects() {
    return [
      { source: "/admin/registrations", destination: "/admin", permanent: false },
      { source: "/admin/colleges", destination: "/admin", permanent: false },
      // Phase 9: one login page for admins and POCs.
      { source: "/admin/login", destination: "/login", permanent: false },
      // Phase 10: the POC portal replaced "My registration".
      { source: "/my", destination: "/college", permanent: false },
    ];
  },
  partialPrefetching: true,
  turbopack: {
    root: __dirname,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;

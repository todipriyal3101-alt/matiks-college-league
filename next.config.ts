import type { NextConfig } from "next";

// College logos live in Supabase Storage's public "logos" bucket; CollegeLogo optimises them with next/image.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return null;
  }
})();

const nextConfig: NextConfig = {
  cacheComponents: true,
  images: {
    remotePatterns: supabaseHost ? [{ protocol: "https", hostname: supabaseHost, pathname: "/storage/v1/object/public/logos/**" }] : [],
  },
  async redirects() {
    return [
      // The registered-colleges list (/admin/colleges) replaced the old registrations page.
      { source: "/admin/registrations", destination: "/admin/colleges", permanent: false },
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

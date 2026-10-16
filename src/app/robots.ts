import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/college", "/auth", "/api", "/login", "/reset-password", "/no-access", "/register/success"] },
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}

import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/** The only public entry point is sign in / create account. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${siteUrl}/login`, changeFrequency: "monthly", priority: 1 }];
}

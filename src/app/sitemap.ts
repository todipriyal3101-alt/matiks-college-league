import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/site-url";

/** Public pages only. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: siteUrl, changeFrequency: "weekly", priority: 1 },
    { url: `${siteUrl}/register`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${siteUrl}/colleges`, changeFrequency: "daily", priority: 0.7 },
    { url: `${siteUrl}/fixtures`, changeFrequency: "daily", priority: 0.7 },
  ];
}

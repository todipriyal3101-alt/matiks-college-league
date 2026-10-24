import type { MetadataRoute } from "next";

import { getCollegeRace } from "@/lib/data/public";
import { siteUrl } from "@/lib/site-url";

/** Public pages: home, the duel, sign in and every approved college's page. Certificates and invites stay out. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [india, usa] = await Promise.all([getCollegeRace("india"), getCollegeRace("usa")]);
  return [
    { url: siteUrl, changeFrequency: "daily", priority: 1 },
    { url: `${siteUrl}/duel`, changeFrequency: "daily", priority: 0.8 },
    { url: `${siteUrl}/login`, changeFrequency: "monthly", priority: 0.5 },
    ...[...india, ...usa].map((c) => ({ url: `${siteUrl}/c/${c.slug}`, changeFrequency: "weekly" as const, priority: 0.6 })),
  ];
}

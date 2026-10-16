/**
 * Public site origin without a trailing slash: NEXT_PUBLIC_SITE_URL (set to the production domain in Vercel).
 * A value without a scheme gets https://; an invalid one (or none) falls back to Vercel's production URL, then
 * localhost, so a bad env var can't break the build (layout.tsx builds metadataBase from it).
 */
function resolveSiteUrl(): string {
  const candidates = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL,
    process.env.VERCEL_URL,
  ];
  for (const raw of candidates) {
    const value = raw?.trim();
    if (!value) continue;
    try {
      const url = new URL(/^https?:\/\//.test(value) ? value : `https://${value}`);
      if (url.hostname.includes(".") || url.hostname === "localhost") return url.origin;
    } catch {
      // Try the next one.
    }
  }
  return "http://localhost:3000";
}

export const siteUrl = resolveSiteUrl();

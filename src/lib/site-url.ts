/** Public site origin without a trailing slash (NEXT_PUBLIC_SITE_URL; set to the production domain in Vercel). */
export const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

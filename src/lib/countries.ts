import { Constants } from "@/lib/database.types";

// Zod-free so client components (the home page race) can import these without shipping zod.
export const COUNTRIES = Constants.public.Enums.country;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_LABELS: Record<Country, string> = { india: "India", usa: "USA" };
export const COUNTRY_FLAGS: Record<Country, string> = { india: "🇮🇳", usa: "🇺🇸" };

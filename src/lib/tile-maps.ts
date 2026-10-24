// Tile maps for the college race: each state is a rounded square at its rough geographic position, so there are
// no boundaries to get wrong and no map licence to manage. Drawn for this project (no third-party data).

import type { Country } from "@/lib/validation/portal";

export type Tile = { code: string; name: string; col: number; row: number; aliases?: string[] };

export const INDIA_TILES: Tile[] = [
  { code: "JK", name: "Jammu and Kashmir", col: 2, row: 0, aliases: ["j&k", "jammu & kashmir"] },
  { code: "LA", name: "Ladakh", col: 3, row: 0 },
  { code: "CH", name: "Chandigarh", col: 0, row: 1 },
  { code: "PB", name: "Punjab", col: 1, row: 1 },
  { code: "HP", name: "Himachal Pradesh", col: 2, row: 1 },
  { code: "UK", name: "Uttarakhand", col: 3, row: 1, aliases: ["uttaranchal", "ut"] },
  { code: "SK", name: "Sikkim", col: 6, row: 1 },
  { code: "AR", name: "Arunachal Pradesh", col: 8, row: 1 },
  { code: "RJ", name: "Rajasthan", col: 0, row: 2 },
  { code: "HR", name: "Haryana", col: 1, row: 2 },
  { code: "DL", name: "Delhi", col: 2, row: 2, aliases: ["new delhi", "nct of delhi", "nct delhi"] },
  { code: "UP", name: "Uttar Pradesh", col: 3, row: 2 },
  { code: "BR", name: "Bihar", col: 4, row: 2 },
  { code: "AS", name: "Assam", col: 6, row: 2 },
  { code: "NL", name: "Nagaland", col: 7, row: 2 },
  { code: "GJ", name: "Gujarat", col: 0, row: 3 },
  { code: "MP", name: "Madhya Pradesh", col: 1, row: 3 },
  { code: "CG", name: "Chhattisgarh", col: 2, row: 3, aliases: ["chattisgarh", "ct"] },
  { code: "JH", name: "Jharkhand", col: 3, row: 3 },
  { code: "WB", name: "West Bengal", col: 4, row: 3 },
  { code: "ML", name: "Meghalaya", col: 5, row: 3 },
  { code: "TR", name: "Tripura", col: 6, row: 3 },
  { code: "MN", name: "Manipur", col: 7, row: 3 },
  { code: "DN", name: "Dadra and Nagar Haveli and Daman and Diu", col: 0, row: 4, aliases: ["dadra and nagar haveli", "daman and diu", "dnhdd"] },
  { code: "MH", name: "Maharashtra", col: 1, row: 4 },
  { code: "TG", name: "Telangana", col: 2, row: 4, aliases: ["ts"] },
  { code: "OD", name: "Odisha", col: 3, row: 4, aliases: ["orissa", "or"] },
  { code: "MZ", name: "Mizoram", col: 6, row: 4 },
  { code: "GA", name: "Goa", col: 1, row: 5 },
  { code: "KA", name: "Karnataka", col: 2, row: 5 },
  { code: "AP", name: "Andhra Pradesh", col: 3, row: 5 },
  { code: "AN", name: "Andaman and Nicobar Islands", col: 5, row: 5, aliases: ["andaman & nicobar islands", "andaman and nicobar"] },
  { code: "LD", name: "Lakshadweep", col: 0, row: 6 },
  { code: "KL", name: "Kerala", col: 2, row: 6 },
  { code: "TN", name: "Tamil Nadu", col: 3, row: 6 },
  { code: "PY", name: "Puducherry", col: 4, row: 6, aliases: ["pondicherry"] },
];

export const USA_TILES: Tile[] = [
  { code: "AK", name: "Alaska", col: 0, row: 0 },
  { code: "ME", name: "Maine", col: 11, row: 0 },
  { code: "WI", name: "Wisconsin", col: 6, row: 1 },
  { code: "VT", name: "Vermont", col: 10, row: 1 },
  { code: "NH", name: "New Hampshire", col: 11, row: 1 },
  { code: "WA", name: "Washington", col: 1, row: 2 },
  { code: "ID", name: "Idaho", col: 2, row: 2 },
  { code: "MT", name: "Montana", col: 3, row: 2 },
  { code: "ND", name: "North Dakota", col: 4, row: 2 },
  { code: "MN", name: "Minnesota", col: 5, row: 2 },
  { code: "IL", name: "Illinois", col: 6, row: 2 },
  { code: "MI", name: "Michigan", col: 7, row: 2 },
  { code: "NY", name: "New York", col: 9, row: 2 },
  { code: "MA", name: "Massachusetts", col: 10, row: 2 },
  { code: "OR", name: "Oregon", col: 1, row: 3 },
  { code: "NV", name: "Nevada", col: 2, row: 3 },
  { code: "WY", name: "Wyoming", col: 3, row: 3 },
  { code: "SD", name: "South Dakota", col: 4, row: 3 },
  { code: "IA", name: "Iowa", col: 5, row: 3 },
  { code: "IN", name: "Indiana", col: 6, row: 3 },
  { code: "OH", name: "Ohio", col: 7, row: 3 },
  { code: "PA", name: "Pennsylvania", col: 8, row: 3 },
  { code: "NJ", name: "New Jersey", col: 9, row: 3 },
  { code: "CT", name: "Connecticut", col: 10, row: 3 },
  { code: "RI", name: "Rhode Island", col: 11, row: 3 },
  { code: "CA", name: "California", col: 1, row: 4 },
  { code: "UT", name: "Utah", col: 2, row: 4 },
  { code: "CO", name: "Colorado", col: 3, row: 4 },
  { code: "NE", name: "Nebraska", col: 4, row: 4 },
  { code: "MO", name: "Missouri", col: 5, row: 4 },
  { code: "KY", name: "Kentucky", col: 6, row: 4 },
  { code: "WV", name: "West Virginia", col: 7, row: 4 },
  { code: "VA", name: "Virginia", col: 8, row: 4 },
  { code: "MD", name: "Maryland", col: 9, row: 4 },
  { code: "DE", name: "Delaware", col: 10, row: 4 },
  { code: "AZ", name: "Arizona", col: 2, row: 5 },
  { code: "NM", name: "New Mexico", col: 3, row: 5 },
  { code: "KS", name: "Kansas", col: 4, row: 5 },
  { code: "AR", name: "Arkansas", col: 5, row: 5 },
  { code: "TN", name: "Tennessee", col: 6, row: 5 },
  { code: "NC", name: "North Carolina", col: 7, row: 5 },
  { code: "SC", name: "South Carolina", col: 8, row: 5 },
  { code: "DC", name: "District of Columbia", col: 9, row: 5, aliases: ["washington dc", "washington d.c."] },
  { code: "OK", name: "Oklahoma", col: 4, row: 6 },
  { code: "LA", name: "Louisiana", col: 5, row: 6 },
  { code: "MS", name: "Mississippi", col: 6, row: 6 },
  { code: "AL", name: "Alabama", col: 7, row: 6 },
  { code: "GA", name: "Georgia", col: 8, row: 6 },
  { code: "HI", name: "Hawaii", col: 0, row: 7 },
  { code: "TX", name: "Texas", col: 4, row: 7 },
  { code: "FL", name: "Florida", col: 9, row: 7 },
];

export const TILES: Record<Country, Tile[]> = { india: INDIA_TILES, usa: USA_TILES };

const norm = (s: string) => s.toLowerCase().replace(/&/g, "and").replace(/[^a-z]/g, "");

/** A college's free-text state ("Tamil Nadu", "TN", "Orissa") → its tile code, or null. */
export function stateCode(country: Country, state: string | null | undefined): string | null {
  if (!state) return null;
  const n = norm(state);
  const hit = TILES[country].find(
    (t) => norm(t.code) === n || norm(t.name) === n || t.aliases?.some((a) => norm(a) === n),
  );
  return hit?.code ?? null;
}

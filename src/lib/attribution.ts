// Attribution: first-touch UTM params + last-touch ambassador ref code, captured in src/proxy.ts
// (see there for the rules), read by submitRegistration.

export const ATTRIBUTION_COOKIE = "mcl_attribution";
export const ATTRIBUTION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export const ATTRIBUTION_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "ref",
] as const;

export type Attribution = Partial<
  Record<(typeof ATTRIBUTION_KEYS)[number], string>
>;

const MAX_VALUE_LENGTH = 100;

function clean(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, MAX_VALUE_LENGTH);
  return trimmed || undefined;
}

export function attributionFromSearchParams(
  params: URLSearchParams,
): Attribution | null {
  const result: Attribution = {};
  for (const key of ATTRIBUTION_KEYS) {
    const value = clean(params.get(key));
    if (value) result[key] = value;
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function parseAttributionCookie(raw: string | undefined): Attribution {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const result: Attribution = {};
    for (const key of ATTRIBUTION_KEYS) {
      const value = clean((parsed as Record<string, unknown>)[key]);
      if (value) result[key] = value;
    }
    return result;
  } catch {
    return {};
  }
}

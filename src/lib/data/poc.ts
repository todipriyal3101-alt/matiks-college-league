import "server-only";

import { cache } from "react";

import { getMyRegistrations, type MyRegistration } from "@/lib/data/league-ops";
import { createClient } from "@/lib/supabase/server";

export type PocContext = {
  userId: string;
  email: string;
  /** From sign-up (auth metadata); empty when missing, then the Register tab asks. */
  name: string;
  phone: string;
  registrations: MyRegistration[];
};

/** The signed-in POC: account, profile and their registrations (newest season first). Null when signed out. */
export const getPocContext = cache(async (): Promise<PocContext | null> => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (!claims?.sub) return null;
  const meta = (claims.user_metadata ?? {}) as { name?: unknown; phone?: unknown };
  return {
    userId: claims.sub,
    email: claims.email ?? "",
    name: typeof meta.name === "string" ? meta.name : "",
    phone: typeof meta.phone === "string" ? meta.phone : "",
    registrations: await getMyRegistrations(),
  };
});

/** The registration a POC page shows: ?r= if it's theirs, else the newest. */
export function pickRegistration(ctx: PocContext, r: string | string[] | undefined): MyRegistration | null {
  return ctx.registrations.find((m) => m.id === r) ?? ctx.registrations[0] ?? null;
}

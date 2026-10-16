import "server-only";

import { getAdmin } from "@/lib/auth/admin";
import { getMyRegistrations } from "@/lib/data/league-ops";
import { createClient } from "@/lib/supabase/server";

/** Where a person belongs after login: admins/viewers → /admin, POCs → /college, others → /no-access. */
export async function homePath(): Promise<"/admin" | "/college" | "/no-access" | "/login"> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return "/login";
  if (await getAdmin()) return "/admin";
  if ((await getMyRegistrations()).length > 0) return "/college";
  return "/no-access";
}

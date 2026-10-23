import "server-only";

import { getAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Where a person belongs after login: admins/viewers → /admin; everyone else → /college (a POC with no college
 * lands on its Register tab); signed out → /login.
 */
export async function homePath(): Promise<"/admin" | "/college" | "/login"> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims.sub) return "/login";
  if (await getAdmin()) return "/admin";
  return "/college";
}

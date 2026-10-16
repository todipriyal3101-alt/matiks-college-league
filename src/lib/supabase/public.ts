import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

// Cookie-free anon client for public data (leagues, colleges, matches).
// RLS applies as the anon role. Safe inside "use cache" because it never reads cookies.
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

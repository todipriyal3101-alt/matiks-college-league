import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";

import type { Database } from "@/lib/database.types";

// Per-user client (reads the session cookie). Renders at request time only:
// supabase-js checks token expiry with Date.now(), which Cache Components forbids while
// prerendering, and with Partial Prefetching cookies() alone does not stop prerendering.
export async function createClient() {
  await connection();
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component, where cookies are read-only.
            // Safe to ignore: src/proxy.ts refreshes the session on every request.
          }
        },
      },
    },
  );
}

import type { NextRequest } from "next/server";

import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  attributionFromSearchParams,
  parseAttributionCookie,
} from "@/lib/attribution";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response } = await updateSession(request);

  // UTM params are first-touch: only the first landing with params sets them.
  // ref is last-touch: the ambassador link that actually brought the student in gets credit.
  const fromUrl = attributionFromSearchParams(request.nextUrl.searchParams);
  if (fromUrl) {
    const existingRaw = request.cookies.get(ATTRIBUTION_COOKIE)?.value;
    const existing = existingRaw ? parseAttributionCookie(existingRaw) : null;
    const next = existing
      ? fromUrl.ref && fromUrl.ref !== existing.ref
        ? { ...existing, ref: fromUrl.ref }
        : null
      : fromUrl;
    if (next) {
      response.cookies.set(ATTRIBUTION_COOKIE, JSON.stringify(next), {
        maxAge: ATTRIBUTION_MAX_AGE,
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        path: "/",
      });
    }
  }

  // Phase 4: guard /admin/* here.
  return response;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};

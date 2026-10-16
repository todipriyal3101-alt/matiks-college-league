import { NextResponse, type NextRequest } from "next/server";

import {
  ATTRIBUTION_COOKIE,
  ATTRIBUTION_MAX_AGE,
  attributionFromSearchParams,
  parseAttributionCookie,
} from "@/lib/attribution";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, supabase, claims } = await updateSession(request);
  const { pathname } = request.nextUrl;
  const next = pathname + request.nextUrl.search;

  // /admin/* needs a user with an admin_profiles row; /college needs a login (RLS decides what they see).
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isCollegeRoute = pathname === "/college" || pathname.startsWith("/college/");
  if ((isAdminRoute || isCollegeRoute) && !claims) {
    return redirectTo(request, response, "/login", { next });
  }
  if (isAdminRoute) {
    // RLS lets a user read their own admin_profiles row.
    const { data: profile } = await supabase
      .from("admin_profiles")
      .select("user_id")
      .eq("user_id", claims!.sub)
      .maybeSingle();
    if (!profile) return redirectTo(request, response, "/no-access", {});
  }

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

  return response;
}

/** Redirect, keeping any refreshed Supabase session cookies. */
function redirectTo(
  request: NextRequest,
  response: NextResponse,
  path: string,
  params: Record<string, string>,
) {
  const url = new URL(path, request.url);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const redirect = NextResponse.redirect(url);
  response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

export const config = {
  matcher: [
    // Skip Next.js internals and static files.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$).*)",
  ],
};

import { NextResponse, type NextRequest } from "next/server";

import { homePath } from "@/lib/auth/home";
import { safeNext } from "@/lib/safe-next";

/** After any login: honour `next` if it's inside the person's area, else send them home by role. */
export async function GET(request: NextRequest) {
  const home = await homePath();
  const next = safeNext(request.nextUrl.searchParams.get("next"), home);
  const allowed =
    (home === "/admin" && (next.startsWith("/admin") || next.startsWith("/college"))) ||
    (home === "/college" && next.startsWith("/college"));
  return NextResponse.redirect(new URL(allowed ? next : home, request.nextUrl.origin));
}

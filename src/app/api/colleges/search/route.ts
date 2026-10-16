import { NextResponse, type NextRequest } from "next/server";

import { searchColleges } from "@/lib/data/colleges";

// Always fresh: reading searchParams makes this route dynamic, and no-store
// stops browsers/CDNs from caching results.
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 100);

  try {
    const colleges = await searchColleges(q);
    return NextResponse.json(
      { colleges },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: "Search failed" },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

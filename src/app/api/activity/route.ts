import { connection, NextResponse } from "next/server";

import { getActivityFeed, getEarlyBirdLeft } from "@/lib/data/public";

// Polled by the activity ticker every 30 s. Public data only (public_activity_feed: no people, pending colleges by
// state only); a short shared cache keeps the polling cheap.
export async function GET() {
  await connection(); // per request (the data helpers cache for ~30 s), never baked in at build time
  try {
    const [items, earlyBirdLeft] = await Promise.all([getActivityFeed(), getEarlyBirdLeft()]);
    return NextResponse.json({ items, earlyBirdLeft }, { headers: { "Cache-Control": "public, s-maxage=15, stale-while-revalidate=30" } });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Activity unavailable" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}

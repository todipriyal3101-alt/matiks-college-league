import { NextResponse, type NextRequest } from "next/server";

import { collegeCardImage, type CardFormat } from "@/lib/college-card";
import { getPublicCollege } from "@/lib/data/public";

/** The shareable college card: ?format=post (1200×627, LinkedIn) | story (1080×1920, Instagram); &download=1. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const college = /^[a-z0-9-]{1,120}$/.test(slug) ? await getPublicCollege(slug) : null;
  if (!college) return new NextResponse("Not found", { status: 404 });
  const format: CardFormat = request.nextUrl.searchParams.get("format") === "story" ? "story" : "post";
  const image = await collegeCardImage(college, format);
  const png = await image.arrayBuffer();
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(png, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=300, s-maxage=300",
      ...(download && { "Content-Disposition": `attachment; filename="${slug}-matiks-${format}.png"` }),
    },
  });
}

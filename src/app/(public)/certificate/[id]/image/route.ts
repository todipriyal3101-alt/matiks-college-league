import { NextResponse, type NextRequest } from "next/server";
import sharp from "sharp";

import { CERT_SIZE, certificateImage } from "@/lib/certificate-art";
import { getPublicCertificate } from "@/lib/data/public";
import { slug } from "@/lib/logos";
import { jpegToPdf } from "@/lib/pdf";

const CERT_ID = /^MCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;

/** ?format=png (default) | pdf. Hidden or withdrawn certificates: 404 (the LinkedIn link stops working too). */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex" };
  if (!CERT_ID.test(id)) return new NextResponse("Not found", { status: 404, headers });
  const cert = await getPublicCertificate(id);
  if (!cert) return new NextResponse("This certificate isn't available.", { status: 404, headers });

  const png = Buffer.from(await (await certificateImage(cert)).arrayBuffer());
  const name = `Matiks-Campus-Lead-${slug(cert.recipient_name)}`;
  if (request.nextUrl.searchParams.get("format") === "pdf") {
    const jpeg = await sharp(png).jpeg({ quality: 92 }).toBuffer();
    const pdf = jpegToPdf(jpeg, CERT_SIZE.width, CERT_SIZE.height, `Campus Lead certificate ${cert.id}`);
    return new NextResponse(new Uint8Array(pdf), {
      headers: { ...headers, "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${name}.pdf"` },
    });
  }
  const download = request.nextUrl.searchParams.get("download") === "1";
  return new NextResponse(new Uint8Array(png), {
    headers: { ...headers, "Content-Type": "image/png", ...(download && { "Content-Disposition": `attachment; filename="${name}.png"` }) },
  });
}

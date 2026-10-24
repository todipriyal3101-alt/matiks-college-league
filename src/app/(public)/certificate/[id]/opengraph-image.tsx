import { ImageResponse } from "next/og";

import { getPublicCertificate } from "@/lib/data/public";
import { bebas, C, darkBg, sticker, wordmark } from "@/lib/launch-og";

export const alt = "Campus Lead certificate, Matiks College League";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const CERT_ID = /^MCL-[0-9A-F]{4}-[0-9A-F]{4}-[0-9A-F]{4}$/i;

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const cert = CERT_ID.test(id) ? await getPublicCertificate(id) : null;
  const [font, mark, vault] = await Promise.all([bebas(), wordmark(C.lime), sticker("vault")]);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 64, background: darkBg, color: C.fg, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={mark} width={180} height={54} alt="" />
          <span style={{ fontFamily: "Bebas", fontSize: 40 }}>COLLEGE LEAGUE</span>
        </div>
        <span style={{ fontFamily: "Bebas", fontSize: 44, color: C.muted, marginTop: 60, letterSpacing: 4 }}>CAMPUS LEAD</span>
        <span style={{ fontFamily: "Bebas", fontSize: 120, lineHeight: 1, color: C.lime, maxWidth: 820 }}>{(cert?.recipient_name ?? "Certificate").toUpperCase()}</span>
        <span style={{ fontSize: 30, marginTop: 14, maxWidth: 760 }}>{cert ? `${cert.college_name} · ${cert.season}` : "Not available"}</span>
        <img src={vault} width={260} height={220} alt="" style={{ position: "absolute", right: 70, bottom: 70, transform: "rotate(-8deg)" }} />
      </div>
    ),
    { ...size, fonts: [{ name: "Bebas", data: font, weight: 400, style: "normal" }] },
  );
}

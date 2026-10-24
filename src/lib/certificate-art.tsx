/* eslint-disable @next/next/no-img-element -- satori (next/og) renders plain <img>, not next/image */
import "server-only";

import { ImageResponse } from "next/og";

import { siteUrl } from "@/lib/site-url";
import { bebas, C, initials, logoPng, wordmark } from "@/lib/launch-og";

export const CERT_SIZE = { width: 1200, height: 848 };

const day = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

export type CertificateData = {
  id: string;
  recipient_name: string;
  college_name: string;
  college_logo_url: string | null;
  season: string;
  issued_at: string;
};

/** The Campus Lead certificate as an image (PNG download, PDF source). */
export async function certificateImage(c: CertificateData) {
  const [font, mark, logo] = await Promise.all([bebas(), wordmark(C.ink), logoPng(c.college_logo_url, 200)]);
  const verify = `${siteUrl.replace(/^https?:\/\//, "")}/certificate/${c.id}`;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: C.paper, color: C.ink, position: "relative", padding: 26 }}>
        <div style={{ display: "flex", flex: 1, border: `2px solid ${C.ink}`, borderRadius: 22, padding: 10 }}>
          <div style={{ display: "flex", flex: 1, flexDirection: "column", alignItems: "center", border: "1px solid rgba(22,22,22,0.25)", borderRadius: 16, padding: "44px 70px 36px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={mark} width={190} height={57} alt="" />
              <span style={{ fontFamily: "Bebas", fontSize: 38 }}>COLLEGE LEAGUE</span>
            </div>
            <span style={{ fontFamily: "Bebas", fontSize: 28, letterSpacing: 9, color: "#555", marginTop: 26 }}>CERTIFICATE OF RECOGNITION</span>
            <span style={{ fontFamily: "Bebas", fontSize: 76, marginTop: 4 }}>CAMPUS LEAD</span>
            <span style={{ fontFamily: "Bebas", fontSize: c.recipient_name.length > 22 ? 76 : 100, color: "#1f3d0b", marginTop: 16, borderBottom: `4px solid ${C.lime}`, padding: "0 30px" }}>
              {c.recipient_name.toUpperCase()}
            </span>
            <span style={{ fontSize: 21, color: "#333", marginTop: 24, textAlign: "center", maxWidth: 820, lineHeight: 1.4 }}>
              {`for leading ${c.college_name} in the ${c.season} by Matiks, bringing their campus into the inter-college mind sports league.`}
            </span>
            <div style={{ display: "flex", width: "100%", marginTop: "auto", alignItems: "flex-end", justifyContent: "space-between" }}>
              <div style={{ display: "flex", flexDirection: "column", fontSize: 15, color: "#444", gap: 4 }}>
                <span>{`Issued ${day.format(new Date(c.issued_at))}`}</span>
                <span style={{ fontWeight: 700 }}>{`ID ${c.id}`}</span>
                <span style={{ fontSize: 13, color: "#777" }}>{`Verify: ${verify}`}</span>
              </div>
              <div
                style={{
                  display: "flex",
                  width: 120,
                  height: 120,
                  borderRadius: 60,
                  background: C.lime,
                  alignItems: "center",
                  justifyContent: "center",
                  textAlign: "center",
                  fontFamily: "Bebas",
                  fontSize: 24,
                  lineHeight: 1,
                  boxShadow: `0 0 0 6px ${C.paper}, 0 0 0 8px ${C.ink}`,
                }}
              >
                MATIKS VERIFIED
              </div>
              {logo ? (
                <img src={logo} width={92} height={92} alt="" style={{ borderRadius: 20 }} />
              ) : (
                <div style={{ display: "flex", width: 92, height: 92, borderRadius: 20, background: "#9cc7ff", alignItems: "center", justifyContent: "center", fontSize: 22, fontWeight: 800 }}>
                  {initials(c.college_name)}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    ),
    { ...CERT_SIZE, fonts: [{ name: "Bebas", data: font, weight: 400, style: "normal" }] },
  );
}

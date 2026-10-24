import { ImageResponse } from "next/og";

import { getPublicInvite } from "@/lib/data/public";
import { inviteHeadline } from "@/lib/invite-copy";
import { INVITE_CODE_RE } from "@/lib/invite-cookie";
import { bebas, C, darkBg, mascot, sticker, wordmark } from "@/lib/launch-og";

export const alt = "A challenge from the Matiks College League";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** "Ananya from NIT Trichy challenged you — beat 14" preview for LinkedIn / WhatsApp. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = INVITE_CODE_RE.test(code) ? await getPublicInvite(code) : null;
  const h = invite ? inviteHeadline(invite) : { title: "You've been challenged", kicker: "30-second duel" };
  const [font, mark, mascotSrc, streak] = await Promise.all([bebas(), wordmark(C.lime), mascot(), sticker("streak")]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: 64, background: darkBg, color: C.fg, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={mark} width={180} height={54} alt="" />
          <span style={{ fontFamily: "Bebas", fontSize: 40 }}>COLLEGE LEAGUE</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 56, maxWidth: 780 }}>
          <span style={{ fontFamily: "Bebas", fontSize: 76, lineHeight: 1 }}>{h.title.toUpperCase()}</span>
          <span style={{ fontFamily: "Bebas", fontSize: 150, lineHeight: 1, color: C.lime }}>{h.kicker.toUpperCase()}</span>
          <span style={{ fontSize: 28, color: C.muted, marginTop: 16 }}>30-second math duel · no sign-up</span>
        </div>
        <img src={mascotSrc} width={300} height={300} alt="" style={{ position: "absolute", right: 70, bottom: 40 }} />
        <img src={streak} width={150} height={200} alt="" style={{ position: "absolute", right: 330, top: 60, transform: "rotate(8deg)" }} />
      </div>
    ),
    { ...size, fonts: [{ name: "Bebas", data: font, weight: 400, style: "normal" }] },
  );
}

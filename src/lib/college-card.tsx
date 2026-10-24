/* eslint-disable @next/next/no-img-element -- satori (next/og) renders plain <img>, not next/image */
import "server-only";

import { ImageResponse } from "next/og";

import { formatINR, prizeProgress } from "@/lib/league";
import { bebas, C, darkBg, initials, logoPng, sticker, wordmark } from "@/lib/launch-og";

export const CARD_SIZES = {
  post: { width: 1200, height: 627 }, // LinkedIn post
  story: { width: 1080, height: 1920 }, // Instagram story
} as const;
export type CardFormat = keyof typeof CARD_SIZES;

export type CardCollege = {
  name: string;
  city: string | null;
  state: string | null;
  country: "india" | "usa";
  logo_url: string | null;
  players: number;
  season: string;
};

/** "IIT Guwahati is in! 212 players · ₹5,000 unlocked", college logo, Matiks branding. */
export async function collegeCardImage(c: CardCollege, format: CardFormat) {
  const size = CARD_SIZES[format];
  const story = format === "story";
  const [font, mark, logo, trophy] = await Promise.all([bebas(), wordmark(C.lime), logoPng(c.logo_url, 320), sticker("trophy")]);
  const p = prizeProgress(c.players);
  const usa = c.country === "usa";
  const count = new Intl.NumberFormat("en-IN").format(p.players);
  const place = [c.city, c.state].filter(Boolean).join(", ");
  const nameSize = story ? (c.name.length > 18 ? 120 : 160) : c.name.length > 20 ? 92 : 120;

  const Logo = (
    <div style={{ display: "flex", width: story ? 260 : 132, height: story ? 260 : 132, borderRadius: story ? 56 : 30, overflow: "hidden", background: logo ? "#ffffff" : "#ffd27a", alignItems: "center", justifyContent: "center", color: "#1a1a1a", fontSize: story ? 64 : 34, fontWeight: 800, flexShrink: 0 }}>
      {logo ? <img src={logo} width={story ? 260 : 132} height={story ? 260 : 132} alt="" /> : initials(c.name)}
    </div>
  );

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", padding: story ? "110px 90px" : "60px 72px", background: darkBg, color: C.fg, position: "relative" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <img src={mark} width={story ? 260 : 190} height={story ? 78 : 57} alt="" />
          <span style={{ fontFamily: "Bebas", fontSize: story ? 58 : 42 }}>COLLEGE LEAGUE</span>
        </div>

        <div style={{ display: "flex", flexDirection: story ? "column" : "row", alignItems: story ? "flex-start" : "center", gap: story ? 48 : 30, marginTop: story ? 160 : 44 }}>
          {Logo}
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: story ? 34 : 22, fontWeight: 700, color: C.muted, letterSpacing: 3 }}>{[c.season, place].filter(Boolean).join(" · ").toUpperCase()}</span>
            <span style={{ fontFamily: "Bebas", fontSize: nameSize, lineHeight: 0.95, maxWidth: story ? 900 : 880 }}>{c.name.toUpperCase()}</span>
            <span style={{ fontFamily: "Bebas", fontSize: nameSize, lineHeight: 0.95, color: C.lime }}>IS IN!</span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", marginTop: story ? 120 : 40, maxWidth: story ? 900 : 760 }}>
          <span style={{ fontSize: story ? 52 : 34, fontWeight: 800 }}>
            {usa ? `${count} players` : `${count} players · `}
            {!usa && <span style={{ color: C.lime, marginLeft: 10 }}>{`${formatINR(p.unlocked)} unlocked`}</span>}
          </span>
          {!usa && (
            <>
              <div style={{ display: "flex", height: story ? 30 : 22, borderRadius: 99, background: "rgba(255,255,255,0.08)", marginTop: 18, overflow: "hidden" }}>
                <div style={{ display: "flex", width: `${p.pct}%`, height: "100%", borderRadius: 99, background: `linear-gradient(90deg, ${C.lime}, #e8ff9c)` }} />
              </div>
              <span style={{ fontSize: story ? 32 : 20, fontWeight: 600, color: C.muted, marginTop: 12 }}>
                {p.next ? `${p.remaining} more to unlock ${formatINR(p.next.amount)}` : "Top prize tier unlocked"}
              </span>
            </>
          )}
        </div>

        <img src={trophy} width={story ? 420 : 250} height={story ? 408 : 243} alt="" style={{ position: "absolute", right: story ? 90 : 70, bottom: story ? 200 : 54, transform: "rotate(-8deg)" }} />
        <span style={{ position: "absolute", left: story ? 90 : 72, bottom: story ? 100 : 40, fontSize: story ? 34 : 22, fontWeight: 700, color: C.muted }}>matiks.com · Play the 30-second duel</span>
      </div>
    ),
    { ...size, fonts: [{ name: "Bebas", data: font, weight: 400, style: "normal" }] },
  );
}

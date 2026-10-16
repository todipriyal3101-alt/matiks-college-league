import { ImageResponse } from "next/og";

import { LANDING } from "@/app/(public)/content";
import { getActiveLeague } from "@/lib/data/leagues";

// Shared Open Graph card (1200×630) for / and /register: league name, prize pool, deadline. Dark theme.

export const ogSize = { width: 1200, height: 630 };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

export async function leagueOgImage({ eyebrow, cta }: { eyebrow: string; cta: string }) {
  const league = await getActiveLeague();
  const name = league?.name ?? LANDING.fallbackLeagueName;
  const prize = LANDING.prizePool.startsWith("TODO") ? null : LANDING.prizePool;
  const deadline = league?.registration_deadline ? date.format(new Date(league.registration_deadline)) : null;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "radial-gradient(circle at 85% 10%, #3b2470 0%, #0b0d16 55%)",
          color: "#ededf3",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18, fontSize: 30, fontWeight: 700 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#a46bff",
              color: "#0b0d16",
              fontSize: 34,
            }}
          >
            Σ
          </div>
          Matiks College League
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ fontSize: 28, letterSpacing: 6, color: "#a46bff", textTransform: "uppercase" }}>{eyebrow}</div>
          <div style={{ fontSize: 104, fontWeight: 800, lineHeight: 1.02 }}>{name}</div>
          <div style={{ display: "flex", gap: 48, marginTop: 20, fontSize: 32, color: "#9b9bb0" }}>
            {prize && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase" }}>Prize pool</span>
                <span style={{ color: "#ededf3", fontWeight: 700, fontSize: 44 }}>{prize}</span>
              </div>
            )}
            {deadline && (
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: 22, letterSpacing: 3, textTransform: "uppercase" }}>Registration closes</span>
                <span style={{ color: "#ededf3", fontWeight: 700, fontSize: 44 }}>{deadline}</span>
              </div>
            )}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#a46bff", fontWeight: 600 }}>{cta} →</div>
      </div>
    ),
    ogSize,
  );
}

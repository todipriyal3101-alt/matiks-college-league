import { readFile } from "node:fs/promises";
import { join } from "node:path";

import { ImageResponse } from "next/og";

import { LANDING } from "@/app/(public)/content";
import { getActiveLeague } from "@/lib/data/leagues";
import { BRAND, seasonShortName } from "@/lib/league";

// Shared Open Graph card (1200×630) for / and /register, in the matiks.com look: #1a1a1a grid, Bebas Neue,
// lime highlights, the Matiks mascot. League name, prize pool and deadline come from the active league.

export const ogSize = { width: 1200, height: 630 };

const date = new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" });

const assets = () =>
  Promise.all([
    readFile(join(process.cwd(), "src/assets/fonts/BebasNeue-Regular.ttf")),
    readFile(join(process.cwd(), "src/assets/mascot-og.png")),
    readFile(join(process.cwd(), "public/brand/icon.png")),
  ]);

export async function leagueOgImage({ eyebrow, cta }: { eyebrow: string; cta: string }) {
  const [league, [bebas, mascot, icon]] = await Promise.all([getActiveLeague(), assets()]);
  // Brand first; the season name (from the database) only in the small line above it.
  const season = seasonShortName(league?.name);
  const kicker = [season, eyebrow].filter(Boolean).join(" · ");
  const deadline = league?.registration_deadline ? date.format(new Date(league.registration_deadline)) : null;
  const src = (buf: Buffer) => `data:image/png;base64,${buf.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          padding: 64,
          background: "#1a1a1a",
          backgroundImage:
            "linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "56px 56px",
          color: "#ffffff",
          fontFamily: "Bebas Neue",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", width: 820 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 40, letterSpacing: 1 }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
            <img src={src(icon)} width={56} height={56} style={{ borderRadius: 12 }} alt="" />
            MATIKS
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 40, color: "#b1fa63", letterSpacing: 2 }}>{kicker.toUpperCase()}</div>
            <div style={{ fontSize: 112, lineHeight: 0.92, letterSpacing: 2 }}>{BRAND.toUpperCase()}</div>
            <div style={{ display: "flex", gap: 56, marginTop: 24 }}>
              <Fact label="Prize pool" value={LANDING.prizePool} />
              {deadline && <Fact label="Registration closes" value={deadline} />}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              alignSelf: "flex-start",
              background: "#b1fa63",
              color: "#000",
              fontSize: 36,
              padding: "10px 28px",
              borderRadius: 12,
              boxShadow: "0 6px 0 #749f45",
              letterSpacing: 1,
            }}
          >
            {cta.toUpperCase()} →
          </div>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori renders plain img */}
        <img src={src(mascot)} width={340} height={340} alt="" style={{ position: "absolute", right: 48, bottom: 40 }} />
      </div>
    ),
    { ...ogSize, fonts: [{ name: "Bebas Neue", data: bebas, weight: 400, style: "normal" }] },
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <span style={{ fontSize: 28, color: "#a2a2a2", letterSpacing: 2 }}>{label.toUpperCase()}</span>
      <span style={{ fontSize: 56, color: "#b1fa63" }}>{value}</span>
    </div>
  );
}

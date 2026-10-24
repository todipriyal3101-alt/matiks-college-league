/* eslint-disable @next/next/no-img-element -- satori (next/og) renders plain <img>, not next/image */
import "server-only";

import { ImageResponse } from "next/og";

import { bebas, C, initials, logoPng, wordmark } from "@/lib/launch-og";
import { seasonShortName } from "@/lib/league";
import { passQrPng } from "@/lib/pass";

export const PASS_SIZE = { width: 1200, height: 630 };

export type PassData = {
  name: string;
  college: string;
  season: string;
  status: "pending" | "approved" | "waitlisted" | "rejected";
  verified: boolean;
  collegeLogoUrl: string | null;
  clubLogoUrl: string | null;
  code: string;
};

const STATUS = {
  pending: { label: "PENDING REVIEW", bg: "rgba(255,210,122,0.16)", fg: "#ffd27a" },
  waitlisted: { label: "WAITLISTED", bg: "rgba(184,167,245,0.16)", fg: "#b8a7f5" },
  approved: { label: "APPROVED", bg: "rgba(110,231,216,0.16)", fg: "#6ee7d8" },
  rejected: { label: "NOT APPROVED", bg: "rgba(255,143,122,0.16)", fg: "#ff8f7a" },
} as const;

/** The downloadable ticket: POC name, college, logos, season, status, QR to /pass/CODE. */
export async function passImage(p: PassData) {
  const [font, mark, logo, club, qr] = await Promise.all([bebas(), wordmark(C.lime), logoPng(p.collegeLogoUrl, 240), logoPng(p.clubLogoUrl, 160), passQrPng(p.code)]);
  const s = STATUS[p.status];
  const nameSize = p.name.length > 18 ? 92 : 120;
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", padding: 40, background: "#0f0f0f" }}>
        <div style={{ flex: 1, display: "flex", borderRadius: 44, overflow: "hidden", background: `radial-gradient(circle at 100% 0%, rgba(177,250,99,0.22), transparent 50%), radial-gradient(circle at 0% 100%, rgba(184,167,245,0.22), transparent 50%), #171717`, border: "2px solid rgba(255,255,255,0.1)" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "44px 52px", color: C.fg }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src={mark} width={150} height={45} alt="" />
              <span style={{ fontFamily: "Bebas", fontSize: 34 }}>{["COLLEGE LEAGUE", seasonShortName(p.season).toUpperCase()].filter(Boolean).join(" · ")}</span>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 34 }}>
              <div style={{ display: "flex", width: 108, height: 108, borderRadius: 26, overflow: "hidden", background: logo ? "#fff" : "#ffd27a", alignItems: "center", justifyContent: "center", color: "#1a1a1a", fontSize: 30, fontWeight: 800 }}>
                {logo ? <img src={logo} width={108} height={108} alt="" /> : initials(p.college)}
              </div>
              {club && (
                <div style={{ display: "flex", width: 76, height: 76, borderRadius: 20, overflow: "hidden", background: "#fff", alignSelf: "flex-end" }}>
                  <img src={club} width={76} height={76} alt="" />
                </div>
              )}
            </div>
            <span style={{ marginTop: 30, fontSize: 22, fontWeight: 700, letterSpacing: 4, color: C.muted }}>CAMPUS LEAD</span>
            <span style={{ fontFamily: "Bebas", fontSize: nameSize, lineHeight: 0.95, maxWidth: 680 }}>{p.name.toUpperCase()}</span>
            <span style={{ fontSize: 34, fontWeight: 700, marginTop: 6, maxWidth: 680 }}>{p.college}</span>
            <div style={{ display: "flex", gap: 12, marginTop: "auto" }}>
              <span style={{ display: "flex", padding: "8px 18px", borderRadius: 99, background: s.bg, color: s.fg, fontSize: 22, fontWeight: 800 }}>{`● ${s.label}`}</span>
              {p.verified && <span style={{ display: "flex", padding: "8px 18px", borderRadius: 99, background: "rgba(110,231,216,0.16)", color: "#6ee7d8", fontSize: 22, fontWeight: 800 }}>VERIFIED</span>}
            </div>
          </div>
          <div style={{ width: 300, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20, borderLeft: "4px dashed rgba(255,255,255,0.18)" }}>
            <div style={{ display: "flex", padding: 14, borderRadius: 22, background: "#fff" }}>
              <img src={qr} width={200} height={200} alt="" />
            </div>
            <span style={{ fontSize: 18, color: C.muted, letterSpacing: 3 }}>SCAN TO VERIFY</span>
            <span style={{ fontSize: 26, color: C.fg, fontWeight: 700 }}>{`MCL-${p.code.slice(0, 4).toUpperCase()}`}</span>
          </div>
        </div>
      </div>
    ),
    { ...PASS_SIZE, fonts: [{ name: "Bebas", data: font, weight: 400, style: "normal" }] },
  );
}

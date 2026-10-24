import "server-only";

import QRCode from "qrcode";

import { siteUrl } from "@/lib/site-url";

// Campus Lead Pass (0008). The QR always opens /pass/CODE: "Pending review" (no people) until approval, then it
// redirects to the college's public page, so a printed or shared pass keeps working.

export const PASS_CODE_RE = /^[a-z0-9]{12}$/;
export const passUrl = (code: string) => `${siteUrl}/pass/${code}`;

/** The QR as an SVG data URI (crisp at any size; dark modules on white). */
export async function passQrSvg(code: string) {
  const svg = await QRCode.toString(passUrl(code), { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

/** The QR as a PNG data URI (for next/og, which draws images but not inline SVG from strings). */
export async function passQrPng(code: string, size = 360) {
  return QRCode.toDataURL(passUrl(code), { margin: 1, width: size, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
}

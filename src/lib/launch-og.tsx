import "server-only";

import { readFile } from "node:fs/promises";
import { join } from "node:path";

import sharp from "sharp";

import { downloadLogo, logoPath } from "@/lib/logos";

// Shared pieces for the launch images (invite previews, college cards, certificates), rendered with next/og.
// Satori can't draw WebP or CSS masks, so logos are converted to PNG with sharp and the wordmark is tinted by
// editing its SVG fill. Only files in our own logos bucket are read.

// Literal paths (not a computed one) so the output tracer bundles just these files, not the whole project.
const cache = new Map<string, Promise<Buffer>>();
const once = (key: string, load: () => Promise<Buffer>) => {
  if (!cache.has(key)) cache.set(key, load());
  return cache.get(key)!;
};
const cwd = process.cwd();
const STICKERS = {
  trophy: () => readFile(join(cwd, "public/brand/stickers/trophy.png")),
  streak: () => readFile(join(cwd, "public/brand/stickers/streak.png")),
  vault: () => readFile(join(cwd, "public/brand/stickers/vault.png")),
  "game-modes": () => readFile(join(cwd, "public/brand/stickers/game-modes.png")),
};

export const dataUri = (buf: Buffer, type = "image/png") => `data:${type};base64,${buf.toString("base64")}`;

export async function bebas() {
  return once("bebas", () => readFile(join(cwd, "src/assets/fonts/BebasNeue-Regular.ttf")));
}

/** The real Matiks wordmark in a colour (#b1fa63 on dark, #161616 on light). */
export async function wordmark(color: string) {
  const svg = (await once("wordmark", () => readFile(join(cwd, "public/brand/matiks-logo.svg")))).toString().replace("<svg ", `<svg fill="${color}" `);
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`;
}

export async function sticker(name: keyof typeof STICKERS) {
  return dataUri(await once(`sticker:${name}`, STICKERS[name]));
}

export async function mascot() {
  return dataUri(await once("mascot", () => readFile(join(cwd, "src/assets/mascot-og.png"))));
}

/** A college logo as a PNG data URI (any uploaded format), or null when there's none or it isn't ours. */
export async function logoPng(url: string | null | undefined, size = 240): Promise<string | null> {
  const path = logoPath(url);
  if (!path) return null;
  const logo = await downloadLogo(path);
  if (!logo) return null;
  try {
    const png = await sharp(Buffer.from(logo.data)).resize(size, size, { fit: "contain", background: { r: 255, g: 255, b: 255, alpha: 1 } }).flatten({ background: "#ffffff" }).png().toBuffer();
    return dataUri(png);
  } catch {
    return null;
  }
}

/** "IIT Guwahati" → "IITG" style initials for colleges without a logo. */
export function initials(name: string) {
  const words = name.replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);
  const caps = words.filter((w) => w === w.toUpperCase() && w.length > 1);
  if (caps.length) return (caps[0] + (words.find((w) => w !== caps[0])?.[0] ?? "")).slice(0, 4).toUpperCase();
  return words.slice(0, 3).map((w) => w[0]).join("").toUpperCase() || "?";
}

export const C = {
  bg: "#161616",
  fg: "#ffffff",
  muted: "#a9a9a9",
  lime: "#b1fa63",
  lilac: "#b8a7f5",
  paper: "#f6f4ee",
  ink: "#161616",
};

/** The dark launch background: two soft colour washes on #161616. */
export const darkBg = `radial-gradient(circle at 85% 15%, rgba(177,250,99,0.18), transparent 45%), radial-gradient(circle at 0% 100%, rgba(184,167,245,0.18), transparent 45%), ${C.bg}`;

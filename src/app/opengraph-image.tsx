import { leagueOgImage, ogSize } from "@/lib/og";

export const alt = "Matiks College League: inter-college mind sports league";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return leagueOgImage({ eyebrow: "Inter-college mind sports", cta: "Register your college" });
}

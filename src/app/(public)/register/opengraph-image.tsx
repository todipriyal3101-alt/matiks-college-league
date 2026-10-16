import { leagueOgImage, ogSize } from "@/lib/og";

export const alt = "Register your college for the Matiks College League";
export const size = ogSize;
export const contentType = "image/png";

export default function Image() {
  return leagueOgImage({ eyebrow: "Registrations open", cta: "Get your college in" });
}

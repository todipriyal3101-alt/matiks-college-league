import { CARD_SIZES, collegeCardImage } from "@/lib/college-card";
import { getPublicCollege } from "@/lib/data/public";

export const alt = "A college in the Matiks College League";
export const size = CARD_SIZES.post;
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const college = await getPublicCollege(slug);
  return collegeCardImage(
    college ?? { name: "Matiks College League", city: null, state: null, country: "india", logo_url: null, players: 0, season: "" },
    "post",
  );
}

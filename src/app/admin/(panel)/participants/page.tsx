import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Participants" };

export default function AdminParticipantsPage() {
  return <ComingSoon title="Participants" phase={7} />;
}

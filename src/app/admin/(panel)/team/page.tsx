import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Team" };

export default function AdminTeamPage() {
  return <ComingSoon title="Team" phase={7} />;
}

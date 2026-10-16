import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Leagues" };

export default function AdminLeaguesPage() {
  return <ComingSoon title="Leagues" phase={7} />;
}

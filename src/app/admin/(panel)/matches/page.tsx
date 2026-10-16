import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Matches" };

export default function AdminMatchesPage() {
  return <ComingSoon title="Matches" phase={7} />;
}

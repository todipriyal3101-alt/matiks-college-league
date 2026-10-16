import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Ambassadors" };

export default function AdminAmbassadorsPage() {
  return <ComingSoon title="Ambassadors" phase={7} />;
}

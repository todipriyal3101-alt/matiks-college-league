import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Colleges" };

export default function AdminCollegesPage() {
  return <ComingSoon title="Colleges" phase={5} />;
}

import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Import" };

export default function AdminImportPage() {
  return <ComingSoon title="Import" phase={8} />;
}

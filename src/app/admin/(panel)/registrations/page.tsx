import type { Metadata } from "next";

import { ComingSoon } from "@/components/admin/coming-soon";

export const metadata: Metadata = { title: "Registrations" };

export default function AdminRegistrationsPage() {
  return <ComingSoon title="Registrations" phase={5} />;
}

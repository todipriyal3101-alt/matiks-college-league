import { SearchXIcon } from "lucide-react";
import Link from "next/link";

import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";

// notFound() inside the admin panel (e.g. a deleted or mistyped college): no mascot in admin.
export default function AdminNotFound() {
  return (
    <EmptyState
      icon={SearchXIcon}
      title="Not found"
      description="This college or page doesn't exist. It may have been deleted or merged."
      action={
        <Button asChild>
          <Link href="/admin">Back to Overview</Link>
        </Button>
      }
    />
  );
}

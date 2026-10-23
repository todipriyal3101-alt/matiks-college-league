import { ClipboardPenIcon } from "lucide-react";
import Link from "next/link";

import { Glass } from "@/components/glass";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";

/** Chat / Winners before the POC has registered a college. */
export function NeedsRegistration({ what }: { what: string }) {
  return (
    <Glass className="p-6">
      <EmptyState
        icon={ClipboardPenIcon}
        title="Register your college first"
        description={`${what} opens once you've registered your college.`}
        action={
          <Button asChild className="h-11 rounded-full px-5">
            <Link href="/college">Go to Register</Link>
          </Button>
        }
      />
    </Glass>
  );
}

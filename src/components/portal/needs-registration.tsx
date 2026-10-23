import { ClipboardPenIcon } from "lucide-react";
import Link from "next/link";

import { Glass } from "@/components/glass";
import { EmptyState } from "@/components/league/empty-state";
import { Button } from "@/components/ui/button";
import { SUPPORT_EMAIL } from "@/lib/league";

/**
 * Chat / Winners before the POC has registered a college. While new registrations are paused there's no college
 * chat to use yet, so point to the support email instead.
 */
export function NeedsRegistration({ what, paused = false }: { what: string; paused?: boolean }) {
  if (paused) {
    return (
      <Glass className="p-6">
        <EmptyState
          icon={ClipboardPenIcon}
          title="New registrations are paused"
          description={
            <>
              {what} opens once your college is registered. Until registrations reopen, write to{" "}
              <a href={`mailto:${SUPPORT_EMAIL}`} className="font-semibold text-primary underline-offset-4 hover:underline">
                {SUPPORT_EMAIL}
              </a>
              .
            </>
          }
        />
      </Glass>
    );
  }
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

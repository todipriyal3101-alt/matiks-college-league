import type { Metadata } from "next";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { TeamContacts } from "@/components/portal/team-contacts";
import { ProfileForm } from "@/components/portal/profile-form";
import { Skeleton } from "@/components/ui/skeleton";
import { getRegistrationDetail } from "@/lib/data/league-ops";
import { getPocContext, pickRegistration } from "@/lib/data/poc";

export const metadata: Metadata = { title: "Profile & contacts" };

/** Account menu › Profile & contacts: the POC's account name/phone, and the college's Team contacts (max 3). */
export default function ProfilePage({ searchParams }: PageProps<"/college/profile">) {
  return (
    <div className="fade-in space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Your account</p>
        <h1 className="text-5xl sm:text-6xl">Profile &amp; contacts</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-3xl" />}>
        <Profile searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Profile({ searchParams }: Pick<PageProps<"/college/profile">, "searchParams">) {
  const [ctx, { r }] = await Promise.all([getPocContext(), searchParams]);
  if (!ctx) return null;
  const selected = pickRegistration(ctx, r);
  const detail = selected ? await getRegistrationDetail(selected.id) : null;
  return (
    <>
      <Glass className="p-5 sm:p-7">
        <ProfileForm initial={{ name: ctx.name, phone: ctx.phone }} email={ctx.email} />
      </Glass>
      {selected && detail && <TeamContacts registrationId={selected.id} contacts={detail.contacts} />}
    </>
  );
}

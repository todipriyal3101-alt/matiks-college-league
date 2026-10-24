import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { CollegeLogo } from "@/components/league/college-logo";
import { JoinTeamButton } from "@/components/register/join-team-button";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SQUAD_CODE_RE } from "@/lib/invite-cookie";
import { brandedSeason } from "@/lib/league";
import { createPublicClient } from "@/lib/supabase/public";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Join your college's team", robots: { index: false, follow: false } };

/** A Campus Lead's co-lead link: shows the college (no names) and joins the signed-in user to the team. */
export default function JoinPage({ params }: PageProps<"/j/[code]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 w-full max-w-lg rounded-3xl" />}>
      <Join params={params} />
    </Suspense>
  );
}

async function Join({ params }: Pick<PageProps<"/j/[code]">, "params">) {
  const { code } = await params;
  const info = SQUAD_CODE_RE.test(code) ? ((await createPublicClient().rpc("squad_invite_info", { p_code: code })).data?.[0] ?? null) : null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const signedIn = !!data?.claims.sub;
  const next = encodeURIComponent(`/j/${code}`);

  return (
    <Glass className="mx-auto max-w-lg space-y-4 p-6 text-center sm:p-8">
      {info?.open ? (
        <>
          <CollegeLogo url={info.college_logo_url} name={info.college_name} className="mx-auto size-20" />
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{brandedSeason(info.season)}</p>
          <h1 className="text-5xl">Join {info.college_name}&apos;s team</h1>
          <p className="text-foreground/85">You&apos;re invited as a co-lead: see the registration, chat with Matiks and help run your college&apos;s league.</p>
          {signedIn ? (
            <JoinTeamButton code={code} />
          ) : (
            <div className="grid gap-2.5">
              <Button asChild className="h-12 rounded-full">
                <Link href={`/login?mode=signup&next=${next}`}>Create an account to join</Link>
              </Button>
              <Button asChild variant="outline" className="h-12 rounded-full">
                <Link href={`/login?next=${next}`}>I have an account</Link>
              </Button>
            </div>
          )}
        </>
      ) : (
        <>
          <h1 className="text-5xl">This link has expired</h1>
          <p className="text-foreground/85">The team may be full (3 people max) or the link was replaced. Ask your Campus Lead for a new one.</p>
          <Button asChild className="h-12 rounded-full px-6">
            <Link href="/college">Register your college</Link>
          </Button>
        </>
      )}
    </Glass>
  );
}

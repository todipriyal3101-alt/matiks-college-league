import { ClockIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { Glass } from "@/components/glass";
import { CollegeLogo } from "@/components/league/college-logo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { brandedSeason } from "@/lib/league";
import { PASS_CODE_RE } from "@/lib/pass";
import { createPublicClient } from "@/lib/supabase/public";

export const metadata: Metadata = { title: "Campus Lead Pass", robots: { index: false, follow: false } };

/**
 * Where a pass's QR points. Approved → the college's public page. Pending → "Pending review" with the college and
 * season only (no people). Denied or unknown → not available.
 */
export default function PassPage({ params }: PageProps<"/pass/[code]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto h-80 w-full max-w-lg rounded-3xl" />}>
      <Pass params={params} />
    </Suspense>
  );
}

async function Pass({ params }: Pick<PageProps<"/pass/[code]">, "params">) {
  const { code } = await params;
  const pass = PASS_CODE_RE.test(code) ? ((await createPublicClient().rpc("public_pass", { p_code: code })).data?.[0] ?? null) : null;
  if (pass?.status === "approved" && pass.slug) redirect(`/c/${pass.slug}`);

  return (
    <Glass className="mx-auto max-w-lg space-y-4 p-6 text-center sm:p-8">
      {pass ? (
        <>
          <CollegeLogo url={pass.college_logo_url} name={pass.college_name} className="mx-auto size-20" />
          <p className="text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{brandedSeason(pass.season)} · Campus Lead Pass</p>
          <h1 className="text-5xl">{pass.college_name}</h1>
          <p className="inline-flex items-center gap-2 rounded-full bg-status-pending px-4 py-1.5 text-sm font-bold text-status-pending-fg">
            <ClockIcon className="size-4" aria-hidden /> {pass.status === "waitlisted" ? "Waitlisted" : "Pending review"}
          </p>
          <p className="text-foreground/85">This college has registered and a Matiks admin is reviewing it. Its page goes live once it&apos;s approved.</p>
        </>
      ) : (
        <>
          <h1 className="text-5xl">Pass not available</h1>
          <p className="text-foreground/85">This pass doesn&apos;t exist or isn&apos;t active.</p>
        </>
      )}
      <Button asChild className="h-12 rounded-full px-6">
        <Link href="/">Play the 30-second duel</Link>
      </Button>
    </Glass>
  );
}

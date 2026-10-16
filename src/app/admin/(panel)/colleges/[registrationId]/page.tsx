import { ChevronLeftIcon } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "zod";

import { CollegeEditor } from "@/components/league/college-editor/college-editor";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { getRegistrationDetail } from "@/lib/data/league-ops";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "College" };

export default function AdminCollegePage({ params }: PageProps<"/admin/colleges/[registrationId]">) {
  return (
    <div className="space-y-6">
      <Link href="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeftIcon className="size-4" /> All colleges
      </Link>
      <Suspense fallback={<EditorSkeleton />}>
        <Editor params={params} />
      </Suspense>
    </div>
  );
}

async function Editor({ params }: Pick<PageProps<"/admin/colleges/[registrationId]">, "params">) {
  const { registrationId } = await params;
  if (!z.uuid().safeParse(registrationId).success) notFound();

  const [{ profile, isWriter }, detail] = await Promise.all([requireAdmin(), getRegistrationDetail(registrationId)]);
  if (!detail) notFound();

  // Admins can read every admin_profiles row (RLS); used to name people in the activity timeline.
  const supabase = await createClient();
  const { data: admins } = await supabase.from("admin_profiles").select("email, name");
  const adminNames = Object.fromEntries((admins ?? []).map((a) => [a.email.toLowerCase(), a.name ?? a.email]));

  return <CollegeEditor detail={detail} mode="admin" readOnly={!isWriter} me={profile.email} adminNames={adminNames} />;
}

/** Same shape as the editor (title, actions, tabs, panel) so nothing jumps when it loads. */
function EditorSkeleton() {
  return (
    <div className="space-y-5" aria-hidden>
      <div className="space-y-2">
        <Skeleton className="h-3 w-40" />
        <Skeleton className="h-9 w-72" />
        <div className="flex gap-2">
          <Skeleton className="h-9 w-36" />
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-full max-w-lg" />
      <Skeleton className="h-72 w-full rounded-2xl" />
    </div>
  );
}

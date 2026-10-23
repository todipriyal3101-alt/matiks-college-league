import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatsShell } from "@/components/chat/chats-shell";
import { Skeleton } from "@/components/ui/skeleton";
import { requireAdmin } from "@/lib/auth/admin";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chats" };

export default function ChatsPage({ searchParams }: PageProps<"/admin/chats">) {
  return (
    <div className="fade-in space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Matiks admins + every college</p>
        <h1 className="text-5xl sm:text-6xl">Chats</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-[calc(100dvh-15rem)] min-h-[26rem] w-full rounded-3xl" />}>
        <Chats searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Chats({ searchParams }: Pick<PageProps<"/admin/chats">, "searchParams">) {
  const [{ profile, isWriter }, params] = await Promise.all([requireAdmin(), searchParams]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("my_chat_threads");
  if (error) throw new Error(`my_chat_threads: ${error.message}`);
  const t = typeof params.t === "string" ? params.t : null;
  return <ChatsShell initial={data} initialSelectedId={t} meId={profile.user_id} canPost={isWriter} />;
}

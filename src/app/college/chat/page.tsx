import type { Metadata } from "next";
import { Suspense } from "react";

import { ChatView } from "@/components/chat/chat-view";
import { NeedsRegistration } from "@/components/portal/needs-registration";
import { Skeleton } from "@/components/ui/skeleton";
import { getPocContext, pickRegistration } from "@/lib/data/poc";
import { getRegistrationsPaused } from "@/lib/data/portal";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Chat" };

/** The college's chat with Matiks admins (one thread per registration; RLS: own college only). */
export default function PocChatPage({ searchParams }: PageProps<"/college/chat">) {
  return (
    <div className="fade-in space-y-5">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">Questions, dates, prizes</p>
        <h1 className="text-5xl sm:text-6xl">Chat with Matiks</h1>
      </div>
      <Suspense fallback={<Skeleton className="h-[calc(100dvh-17rem)] min-h-[24rem] w-full rounded-3xl" />}>
        <Chat searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Chat({ searchParams }: Pick<PageProps<"/college/chat">, "searchParams">) {
  const [ctx, { r }] = await Promise.all([getPocContext(), searchParams]);
  const selected = ctx && pickRegistration(ctx, r);
  if (!ctx || !selected) return <NeedsRegistration what="Chat" paused={!!ctx && (await getRegistrationsPaused())} />;

  const supabase = await createClient();
  const { data: thread } = await supabase
    .from("chat_threads")
    .select("id, registrations(college_logo_url, colleges(name, logo_url))")
    .eq("registration_id", selected.id)
    .maybeSingle();
  if (!thread) return <NeedsRegistration what="Chat" />;

  const college = thread.registrations?.colleges;
  return (
    <ChatView
      key={thread.id}
      threadId={thread.id}
      title="Matiks team"
      subtitle={`${college?.name ?? selected.colleges.name} · we usually reply within a day`}
      logoUrl="matiks"
      meId={ctx.userId}
      canPost
      className="h-[calc(100dvh-17rem)] min-h-[24rem] md:h-[calc(100dvh-14.5rem)]"
    />
  );
}

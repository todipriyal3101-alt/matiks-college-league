"use client";

import { MessageCircleIcon } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ChatView } from "@/components/chat/chat-view";
import { Glass } from "@/components/glass";
import { CollegeLogo } from "@/components/league/college-logo";
import { EmptyState } from "@/components/league/empty-state";
import { UnreadDot } from "@/components/panel/panel-nav";
import { CHAT_READ_EVENT } from "@/components/panel/use-chat-unread";
import type { Database } from "@/lib/database.types";
import { formatRelative } from "@/lib/ist";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

export type ThreadRow = Database["public"]["Functions"]["my_chat_threads"]["Returns"][number];

const threadTitle = (t: ThreadRow) => (t.kind === "admins" ? "Matiks Admins" : (t.college_name ?? "College"));

/** Admin Chats: "Matiks Admins" + one thread per college (newest first, unread counts). Phones: list, then the chat. */
export function ChatsShell({ initial, initialSelectedId, meId, canPost }: { initial: ThreadRow[]; initialSelectedId: string | null; meId: string; canPost: boolean }) {
  const pathname = usePathname();
  const [threads, setThreads] = useState(initial);
  const [selectedId, setSelectedId] = useState(initialSelectedId);
  const selected = threads.find((t) => t.thread_id === selectedId) ?? null;

  // Live list: re-sort and recount on every new message or read marker.
  useEffect(() => {
    const supabase = createClient();
    const load = async () => {
      const { data } = await supabase.rpc("my_chat_threads");
      if (data) setThreads(data);
    };
    const channel = supabase
      .channel("chat-threads")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();
    window.addEventListener(CHAT_READ_EVENT, load);
    return () => {
      window.removeEventListener(CHAT_READ_EVENT, load);
      void supabase.removeChannel(channel);
    };
  }, []);

  // Switch at once (no server round trip); the URL keeps ?t= so links and reloads open the same chat.
  const open = (id: string | null) => {
    setSelectedId(id);
    window.history.replaceState(null, "", id ? `${pathname}?t=${id}` : pathname);
  };

  return (
    <div className="grid h-[calc(100dvh-15rem)] min-h-[26rem] gap-4 md:h-[calc(100dvh-12.5rem)] md:grid-cols-[20rem_1fr]">
      <Glass className={cn("flex min-h-0 flex-col overflow-hidden p-1.5", selected && "max-md:hidden")}>
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {threads.map((t) => {
            const active = t.thread_id === selectedId;
            return (
              <li key={t.thread_id}>
                <button
                  type="button"
                  onClick={() => open(t.thread_id)}
                  aria-current={active ? "true" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-2xl p-2.5 text-left transition-colors hover:bg-white/8",
                    active && "bg-white/12 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]",
                  )}
                >
                  {t.kind === "admins" ? (
                    // eslint-disable-next-line @next/next/no-img-element -- static brand icon
                    <img src="/brand/icon.png" alt="" className="size-11 rounded-xl" />
                  ) : (
                    <CollegeLogo url={t.college_logo_url} name={threadTitle(t)} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={cn("truncate text-sm", t.unread ? "font-bold" : "font-semibold")}>{threadTitle(t)}</span>
                      {t.last_message_at && <span className="shrink-0 text-[11px] text-muted-foreground">{formatRelative(t.last_message_at)}</span>}
                    </span>
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-muted-foreground">
                        {t.last_body ? `${t.last_sender ? `${t.last_sender}: ` : ""}${t.last_body}` : t.kind === "admins" ? "Team chat for Matiks admins" : "No messages yet"}
                      </span>
                      {t.unread > 0 && <UnreadDot count={t.unread} className="shrink-0" />}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Glass>

      {selected ? (
        <ChatView
          key={selected.thread_id}
          className="min-h-0"
          threadId={selected.thread_id}
          title={threadTitle(selected)}
          subtitle={selected.kind === "admins" ? "Only Matiks admins see this" : "Chat with the college's POCs"}
          logoUrl={selected.kind === "admins" ? "matiks" : selected.college_logo_url}
          meId={meId}
          canPost={canPost}
          onBack={() => open(null)}
        />
      ) : (
        <Glass className="hidden place-items-center md:grid">
          <EmptyState icon={MessageCircleIcon} title="Pick a chat" description="Messages from college POCs show up here as they arrive." />
        </Glass>
      )}
    </div>
  );
}

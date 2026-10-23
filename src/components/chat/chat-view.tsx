"use client";

import { ArrowLeftIcon, Loader2Icon, SendIcon } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Glass } from "@/components/glass";
import { CollegeLogo } from "@/components/league/college-logo";
import { CHAT_READ_EVENT } from "@/components/panel/use-chat-unread";
import { Button } from "@/components/ui/button";
import type { Tables } from "@/lib/database.types";
import { markThreadRead, sendChatMessage } from "@/lib/chat/actions";
import { formatMessageTime } from "@/lib/ist";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Message = Pick<Tables<"chat_messages">, "id" | "sender_id" | "sender_name" | "sender_role" | "body" | "created_at">;

const LIMIT = 200;

/**
 * One chat thread: messages (sender name + time), live via Supabase Realtime (RLS decides who receives what),
 * and a composer when the user may post. Opening it marks the thread read.
 */
export function ChatView({
  threadId,
  title,
  subtitle,
  logoUrl,
  meId,
  canPost,
  onBack,
  className,
}: {
  threadId: string;
  title: string;
  subtitle?: string;
  /** College logo (college threads); the admins thread shows the Matiks icon. */
  logoUrl?: string | null | "matiks";
  meId: string;
  canPost: boolean;
  /** Phones: back to the thread list. */
  onBack?: () => void;
  className?: string;
}) {
  const [messages, setMessages] = useState<Message[] | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, startSending] = useTransition();
  const bottom = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const supabase = createClient();
    // Callers key this component by thread, so a new thread starts from a fresh (loading) state.
    let alive = true;

    const load = async () => {
      const { data, error } = await supabase
        .from("chat_messages")
        .select("id, sender_id, sender_name, sender_role, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (!alive) return;
      if (error) toast.error("Couldn't load the chat.");
      setMessages((data ?? []).reverse());
    };
    const read = () =>
      void markThreadRead(threadId).then(() => window.dispatchEvent(new Event(CHAT_READ_EVENT)));

    void load().then(read);
    const channel = supabase
      .channel(`chat-${threadId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `thread_id=eq.${threadId}` },
        (payload) => {
          const m = payload.new as Message;
          setMessages((list) => (list && !list.some((x) => x.id === m.id) ? [...list, m] : list));
          if (m.sender_id !== meId && document.visibilityState === "visible") read();
        },
      )
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [threadId, meId]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send() {
    const body = draft.trim();
    if (!body || sending) return;
    startSending(async () => {
      const res = await sendChatMessage(threadId, body);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setDraft("");
      // Realtime normally delivers it; reload in case the socket is still connecting.
      const { data } = await createClient()
        .from("chat_messages")
        .select("id, sender_id, sender_name, sender_role, body, created_at")
        .eq("thread_id", threadId)
        .order("created_at", { ascending: false })
        .limit(LIMIT);
      if (data) setMessages(data.reverse());
    });
  }

  return (
    <Glass className={cn("flex min-h-0 flex-col overflow-hidden", className)}>
      <div className="flex items-center gap-3 border-b border-white/8 px-3 py-3 sm:px-4">
        {onBack && (
          <Button type="button" variant="ghost" size="icon" className="size-10 rounded-full md:hidden" onClick={onBack} aria-label="All chats">
            <ArrowLeftIcon />
          </Button>
        )}
        {logoUrl === "matiks" ? (
          // eslint-disable-next-line @next/next/no-img-element -- static brand icon
          <img src="/brand/icon.png" alt="" className="size-10 rounded-xl" />
        ) : (
          <CollegeLogo url={logoUrl} name={title} className="size-10" />
        )}
        <div className="min-w-0">
          <h2 className="truncate font-sans text-base font-bold normal-case">{title}</h2>
          {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-4" aria-live="polite" aria-label="Messages">
        {messages === null ? (
          <div className="grid h-full place-items-center text-muted-foreground">
            <Loader2Icon className="animate-spin" aria-label="Loading" />
          </div>
        ) : messages.length === 0 ? (
          <p className="grid h-full place-items-center px-6 text-center text-sm text-muted-foreground">
            No messages yet. {canPost ? "Say hello 👋" : ""}
          </p>
        ) : (
          <ol className="space-y-3">
            {messages.map((m, i) => {
              const mine = m.sender_id === meId;
              const showName = !mine && messages[i - 1]?.sender_id !== m.sender_id;
              return (
                <li key={m.id} className={cn("flex flex-col", mine ? "items-end" : "items-start")}>
                  {showName && (
                    <span className="mb-1 flex items-center gap-1.5 px-1 text-xs font-semibold text-foreground/85">
                      {m.sender_name}
                      {m.sender_role === "admin" && (
                        <span className="rounded-full bg-olive px-1.5 py-px text-[10px] font-bold text-primary uppercase">Matiks</span>
                      )}
                    </span>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2 text-sm whitespace-pre-wrap break-words sm:max-w-[70%]",
                      mine ? "rounded-br-md bg-primary text-primary-foreground" : "glass-surface rounded-bl-md",
                    )}
                  >
                    {m.body}
                  </div>
                  <time dateTime={m.created_at} className="mt-1 px-1 text-[11px] text-muted-foreground">
                    {formatMessageTime(m.created_at)}
                  </time>
                </li>
              );
            })}
          </ol>
        )}
        <div ref={bottom} />
      </div>

      {canPost ? (
        <form
          className="flex items-end gap-2 border-t border-white/8 p-2.5 sm:p-3"
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
        >
          <label htmlFor={`compose-${threadId}`} className="sr-only">
            Message
          </label>
          <textarea
            id={`compose-${threadId}`}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Enter sends; Shift+Enter is a new line (phones keep Enter as a new line via the send button).
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && window.matchMedia("(pointer: fine)").matches) {
                e.preventDefault();
                send();
              }
            }}
            rows={1}
            maxLength={4000}
            placeholder="Type a message"
            className="field-sizing-content max-h-40 min-h-11 flex-1 resize-none rounded-2xl border border-white/10 bg-black/25 px-3.5 py-2.5 text-base outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 sm:text-sm"
          />
          <Button type="submit" size="icon" className="size-11 shrink-0 rounded-full" disabled={!draft.trim() || sending} aria-label="Send">
            {sending ? <Loader2Icon className="animate-spin" /> : <SendIcon />}
          </Button>
        </form>
      ) : (
        <p className="border-t border-white/8 p-3 text-center text-xs text-muted-foreground">Viewers can read chats but not reply.</p>
      )}
    </Glass>
  );
}

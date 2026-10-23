"use client";

import { BellIcon, CheckCheckIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { UnreadDot } from "@/components/panel/panel-nav";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Tables } from "@/lib/database.types";
import { formatRelative } from "@/lib/ist";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Notification = Pick<Tables<"notifications">, "id" | "title" | "body" | "link" | "read_at" | "created_at">;

/**
 * In-app notifications (migration 0005): the user's own rows only (RLS), live via Realtime.
 * Opening the bell marks everything read.
 */
export function NotificationBell({ userId }: { userId: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = () =>
      supabase
        .from("notifications")
        .select("id, title, body, link, read_at, created_at")
        .order("created_at", { ascending: false })
        .limit(30)
        .then(({ data }) => alive && data && setItems(data));
    void load();
    const channel = supabase
      .channel(`notifications-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` }, () => void load())
      .subscribe();
    return () => {
      alive = false;
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  const unread = items.filter((n) => !n.read_at).length;

  async function markAllRead() {
    if (!unread) return;
    const now = new Date().toISOString();
    setItems((list) => list.map((n) => (n.read_at ? n : { ...n, read_at: now })));
    await createClient().from("notifications").update({ read_at: now }).is("read_at", null);
  }

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) void markAllRead();
      }}
    >
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative size-10 rounded-full bg-white/7 hover:bg-white/12" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <BellIcon className="size-[18px]" />
          {unread > 0 && <UnreadDot count={unread} className="absolute -top-0.5 -right-0.5" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] gap-0 p-1.5">
        <div className="flex items-center justify-between px-2.5 pt-1.5 pb-2">
          <span className="text-sm font-semibold">Notifications</span>
          {unread > 0 && (
            <button type="button" onClick={() => void markAllRead()} className="flex items-center gap-1 text-xs font-semibold text-primary">
              <CheckCheckIcon className="size-3.5" /> Mark all read
            </button>
          )}
        </div>
        {items.length === 0 ? (
          <p className="px-2.5 pb-4 text-sm text-muted-foreground">Nothing yet. Updates about your colleges show up here.</p>
        ) : (
          <ul className="max-h-[60vh] overflow-y-auto">
            {items.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => {
                    setOpen(false);
                    void markAllRead();
                    if (n.link) router.push(n.link);
                  }}
                  className="flex w-full gap-2.5 rounded-xl px-2.5 py-2 text-left hover:bg-white/8"
                >
                  <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.read_at ? "bg-transparent" : "bg-primary")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold">{n.title}</span>
                    {n.body && <span className="mt-0.5 block text-xs text-muted-foreground">{n.body}</span>}
                    <span className="mt-1 block text-[11px] text-muted-foreground">{formatRelative(n.created_at)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

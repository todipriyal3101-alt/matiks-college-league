"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { createClient } from "@/lib/supabase/client";

/** Fired by the chat view after it marks a thread read, so nav badges update at once. */
export const CHAT_READ_EVENT = "mcl:chat-read";

/**
 * Total unread chat messages for the signed-in user (RLS: admins all threads, POCs their own), live via Realtime.
 * Refetches on new messages, on CHAT_READ_EVENT and on navigation.
 */
export function useChatUnread() {
  const [unread, setUnread] = useState(0);
  const pathname = usePathname();

  useEffect(() => {
    const supabase = createClient();
    let alive = true;
    const load = async () => {
      const { data } = await supabase.rpc("my_chat_threads");
      if (alive && data) setUnread(data.reduce((sum, t) => sum + t.unread, 0));
    };
    void load();
    const channel = supabase
      .channel(`chat-unread-${Math.random().toString(36).slice(2)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, () => void load())
      .subscribe();
    window.addEventListener(CHAT_READ_EVENT, load);
    return () => {
      alive = false;
      window.removeEventListener(CHAT_READ_EVENT, load);
      void supabase.removeChannel(channel);
    };
  }, [pathname]);

  return unread;
}

"use server";

import { z } from "zod";

import { createClient } from "@/lib/supabase/server";
import { chatMessageSchema } from "@/lib/validation/portal";

// Chat writes (migration 0005) with the caller's own session: RLS decides who may post where (admin writers: any
// thread; POCs: their college's thread; viewers: none), and the database sets the sender's id, name, role and time.

export type ChatResult = { ok: true } | { ok: false; error: string };

export async function sendChatMessage(threadId: string, body: string): Promise<ChatResult> {
  const parsed = chatMessageSchema.safeParse({ threadId, body });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid message." };
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims.sub) return { ok: false, error: "Sign in again." };
  const { error } = await supabase.from("chat_messages").insert({ thread_id: parsed.data.threadId, body: parsed.data.body });
  if (error) {
    if (error.code === "42501") return { ok: false, error: "You can't post in this chat." };
    console.error("sendChatMessage:", error.code, error.message);
    return { ok: false, error: "Couldn't send. Please try again." };
  }
  return { ok: true };
}

/** Marks a thread read up to now for the caller (their own read marker; RLS checks they can read the thread). */
export async function markThreadRead(threadId: string): Promise<void> {
  if (!z.uuid().safeParse(threadId).success) return;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims.sub;
  if (!userId) return;
  const { error } = await supabase
    .from("chat_reads")
    .upsert({ thread_id: threadId, user_id: userId, last_read_at: new Date().toISOString() }, { onConflict: "thread_id,user_id" });
  if (error) console.error("markThreadRead:", error.message);
}

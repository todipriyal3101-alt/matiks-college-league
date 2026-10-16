"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export async function logout() {
  const supabase = await createClient();
  // This browser only: logging out on a shared laptop shouldn't sign the person out on their phone too.
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}

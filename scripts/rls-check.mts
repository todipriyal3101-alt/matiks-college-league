// RLS check against the REAL Supabase project (PROMPTS Phase 13 step 1): what anon, admin, viewer and POC can
// read and write on every table, the overview view and the RPCs. Same matrix as the local tests
// (supabase/tests/0003_league_ops.test.sql), but through PostgREST with real sessions.
//
//   npm run rls-check                       anon + admin
//   npm run rls-check -- --temp-users       also viewer + POC, using two throwaway auth users that are
//                                           created for the run and deleted at the end
//
// Env (.env.local): NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY,
//   RLS_ADMIN_EMAIL        an existing admin; a session is minted with the service key (no email is sent)
//   RLS_REGISTRATION_ID    a TEST registration used for the write checks. Writes are no-ops (same value) or are
//                          expected to be refused; anything that unexpectedly succeeds is reverted.
//
// Exit code 1 if any check fails.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ADMIN_EMAIL = process.env.RLS_ADMIN_EMAIL;
const REG = process.env.RLS_REGISTRATION_ID;
const TEMP_USERS = process.argv.includes("--temp-users");

if (!URL_ || !ANON || !SERVICE) throw new Error("Missing Supabase env vars (run with --env-file=.env.local).");
if (!ADMIN_EMAIL || !REG) throw new Error("Set RLS_ADMIN_EMAIL and RLS_REGISTRATION_ID (a test registration).");

const opts = { auth: { persistSession: false, autoRefreshToken: false } };
const service = createClient(URL_, SERVICE, opts);

type Result = { role: string; check: string; ok: boolean; detail: string };
const results: Result[] = [];

async function check(role: string, name: string, fn: () => Promise<true | string>) {
  try {
    const r = await fn();
    results.push({ role, check: name, ok: r === true, detail: r === true ? "" : r });
  } catch (e) {
    results.push({ role, check: name, ok: false, detail: `threw: ${(e as Error).message}` });
  }
}

/** A client signed in as `email`, via a magic-link token minted with the service key (no email sent). */
async function sessionFor(email: string): Promise<SupabaseClient> {
  const { data, error } = await service.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw error;
  const client = createClient(URL_, ANON, opts);
  const { error: e2 } = await client.auth.verifyOtp({ type: "magiclink", token_hash: data.properties.hashed_token });
  if (e2) throw e2;
  return client;
}

const PRIVATE_TABLES = [
  "registrations", "contacts", "participants", "winners", "ambassadors", "admin_profiles", "college_access", "activity_log",
  "notifications", "chat_threads", "chat_messages", "chat_reads",
  "invite_codes", "duel_rounds", "certificates", "badges",
] as const;

// A 1×1 PNG for storage checks.
const PNG = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII="), (c) => c.charCodeAt(0));
const upload = (c: SupabaseClient, path: string) => c.storage.from("logos").upload(path, PNG, { contentType: "image/png", upsert: false });

/** The college chat thread of the test registration. */
const regThread = async () => (await service.from("chat_threads").select("id").eq("registration_id", REG!).single()).data!.id as string;
const adminsThread = async () => (await service.from("chat_threads").select("id").eq("kind", "admins").single()).data!.id as string;

const count = async (c: SupabaseClient, table: string) => {
  const { count: n, error } = await c.from(table).select("*", { count: "exact", head: true });
  if (error) return { n: 0, error: error.message };
  return { n: n ?? 0, error: null };
};

const denied = (error: { code?: string; message: string } | null, rows?: unknown[] | null) =>
  error ? true : rows && rows.length === 0 ? true : `allowed (${rows?.length} rows)`;

// ---------- anon ----------
async function anonChecks() {
  const anon = createClient(URL_, ANON, opts);
  const role = "anon";
  for (const t of PRIVATE_TABLES) {
    await check(role, `cannot read ${t}`, async () => {
      const { n, error } = await count(anon, t);
      return error || n === 0 ? true : `sees ${n} rows`;
    });
  }
  await check(role, "cannot read registration_overview", async () => {
    const { n, error } = await count(anon, "registration_overview");
    return error || n === 0 ? true : `sees ${n} rows`;
  });
  await check(role, "reads colleges, matches", async () => {
    const a = await anon.from("colleges").select("id").limit(1);
    const b = await anon.from("matches").select("id").limit(1);
    return !a.error && !b.error ? true : (a.error ?? b.error)!.message;
  });
  await check(role, "never sees draft leagues", async () => {
    const { data, error } = await anon.from("leagues").select("status").eq("status", "draft");
    if (error) return error.message;
    return data.length === 0 ? true : `sees ${data.length} drafts`;
  });
  await check(role, "cannot write colleges", async () => {
    const { data, error } = await anon.from("colleges").insert({ name: "RLS check (should fail)" }).select("id");
    if (data?.length) await service.from("colleges").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "cannot update registrations", async () => {
    const { data, error } = await anon.from("registrations").update({ team_name: "x" }).eq("id", REG!).select("id");
    return denied(error, data);
  });
  for (const [fn, args] of [
    ["create_my_registration", { p_college_id: null, p_college_name: "x", p_country: "india", p_college_email: null, p_email_domain: null, p_college_logo_url: null, p_club_name: null, p_club_logo_url: null, p_registration_start: "2030-01-01", p_league_start: "2030-01-02", p_league_end: "2030-01-03", p_poc_name: "x", p_poc_phone: "9999999999" }],
    ["send_poc_notification", { p_title: "x", p_body: null, p_scope: "all" }],
    ["resubmit_my_registration", { p_registration_id: REG! }],
    ["my_chat_threads", {}],
  ] as const) {
    await check(role, `cannot call ${fn}()`, async () => {
      const { error } = await anon.rpc(fn, args as never);
      return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
    });
  }
  // 0007: public functions are callable and return public columns only.
  for (const [fn, args] of [
    ["public_home_stats", {}],
    ["public_college_race", { p_country: "india" }],
    ["public_state_counts", { p_country: "india" }],
    ["top_duels_today", { p_limit: 5 }],
    ["public_college", { p_slug: "no-such-college" }],
    ["public_invite", { p_code: "0000000000" }],
    ["public_certificate", { p_id: "MCL-0000-0000-0000" }],
  ] as const) {
    await check(role, `can call ${fn}()`, async () => {
      const { error } = await anon.rpc(fn, args as never);
      return error ? error.message : true;
    });
  }
  await check(role, "college race / top today expose no POC contact fields", async () => {
    const race = await anon.rpc("public_college_race", { p_country: "india" });
    const top = await anon.rpc("top_duels_today", { p_limit: 50 });
    const keys = new Set([...(race.data ?? []), ...(top.data ?? [])].flatMap((r: object) => Object.keys(r)));
    const leak = [...keys].filter((k) => /email|phone|poc|contact|user/i.test(k));
    return leak.length ? `exposes ${leak.join(", ")}` : true;
  });
  for (const fn of ["my_invite", "refresh_my_badges", "admin_top_inviters"] as const) {
    await check(role, `cannot call ${fn}()`, async () => {
      const { error } = await anon.rpc(fn, (fn === "admin_top_inviters" ? {} : { p_registration_id: REG! }) as never);
      return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
    });
  }
  // 0008: ticker / rivalry / early-bird / pass / co-lead info are public and person-free; the rest is not.
  for (const [fn, args] of [
    ["public_activity_feed", { p_limit: 12 }],
    ["public_early_bird_left", {}],
    ["public_state_rivalry", { p_state: "Odisha" }],
    ["public_pass", { p_code: "000000000000" }],
    ["squad_invite_info", { p_code: "000000000000" }],
  ] as const) {
    await check(role, `can call ${fn}()`, async () => {
      const { error } = await anon.rpc(fn, args as never);
      return error ? error.message : true;
    });
  }
  await check(role, "activity feed has kind/label/at only", async () => {
    const { data, error } = await anon.rpc("public_activity_feed", { p_limit: 30 });
    if (error) return error.message;
    const extra = [...new Set(data.flatMap((r: object) => Object.keys(r)))].filter((k) => !["kind", "label", "at"].includes(k));
    return extra.length ? `extra columns: ${extra.join(", ")}` : true;
  });
  for (const [fn, args] of [
    ["college_claim_status", { p_college_ids: [] }],
    ["request_to_join", { p_registration_id: REG! }],
    ["redeem_squad_invite", { p_code: "000000000000" }],
    ["my_squad_invites", { p_registration_id: REG! }],
    ["start_email_verification", { p_email: "a@b.co", p_code_hash: "x".repeat(64) }],
    ["mark_registration_viewed", { p_registration_id: REG! }],
  ] as const) {
    await check(role, `cannot call ${fn}()`, async () => {
      const { error } = await anon.rpc(fn, args as never);
      return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
    });
  }
  for (const t of ["registration_drafts", "join_requests", "squad_invites", "email_verifications"] as const) {
    await check(role, `cannot read ${t}`, async () => {
      const { data, error } = await anon.from(t).select("*").limit(1);
      return denied(error, data);
    });
  }
  await check(role, "cannot write duel rounds", async () => {
    const { data, error } = await anon.from("duel_rounds").insert({ seed: 1, ip_hash: "rls", expires_at: new Date().toISOString(), score: 200 } as never).select("id");
    if (data?.length) await service.from("duel_rounds").delete().eq("id", (data[0] as { id: string }).id);
    return denied(error, data);
  });
  await check(role, "cannot upload logos", async () => {
    const { data, error } = await upload(anon, `users/anon-${Date.now()}/x.png`);
    if (data) await service.storage.from("logos").remove([data.path]);
    return error ? true : "uploaded";
  });
  for (const fn of ["register_college", "merge_colleges", "find_user_id_by_email"] as const) {
    await check(role, `cannot call ${fn}()`, async () => {
      const args =
        fn === "register_college"
          ? { p_league_id: REG!, p_poc: {} }
          : fn === "merge_colleges"
            ? { p_keep: REG!, p_duplicate: REG! }
            : { p_email: ADMIN_EMAIL! };
      const { error } = await anon.rpc(fn, args as never);
      return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
    });
  }
  await check(role, "public_approved_colleges() returns public columns only", async () => {
    const { data: league } = await service.from("registrations").select("league_id").eq("id", REG!).single();
    const { data, error } = await anon.rpc("public_approved_colleges", { p_league_id: league!.league_id });
    if (error) return error.message;
    const keys = new Set<string>(data.flatMap((r: object) => Object.keys(r)));
    const extra = [...keys].filter((k) => !["id", "name", "short_name", "city", "state", "logo_url"].includes(k));
    return extra.length ? `extra columns: ${extra.join(", ")}` : true;
  });
}

// ---------- admin ----------
async function adminChecks(admin: SupabaseClient) {
  const role = "admin";
  for (const t of PRIVATE_TABLES) {
    await check(role, `reads ${t}`, async () => {
      const { error } = await count(admin, t);
      return error ?? true;
    });
  }
  await check(role, "can update a registration (no-op write)", async () => {
    const { data: cur } = await admin.from("registrations").select("team_name").eq("id", REG!).single();
    const { data, error } = await admin.from("registrations").update({ team_name: cur!.team_name }).eq("id", REG!).select("id");
    return error ? error.message : data.length === 1 ? true : "0 rows updated";
  });
  await check(role, "cannot write activity_log directly", async () => {
    const { data, error } = await admin
      .from("activity_log")
      .insert({ registration_id: REG!, entity: "registration", entity_id: REG!, action: "changed" } as never)
      .select("id");
    return denied(error, data);
  });
  await check(role, "cannot edit chat messages", async () => {
    const { data, error } = await admin.from("chat_messages").update({ body: "edited" }).neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    return denied(error, data);
  });
  await check(role, "cannot insert notifications directly", async () => {
    const { data: me } = await admin.auth.getUser();
    const { data, error } = await admin.from("notifications").insert({ user_id: me.user!.id, kind: "announcement", title: "x" }).select("id");
    if (data?.length) await service.from("notifications").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "reads only its own notifications", async () => {
    const { data: me } = await admin.auth.getUser();
    const { data, error } = await admin.from("notifications").select("user_id");
    if (error) return error.message;
    return data.every((n) => n.user_id === me.user!.id) ? true : "sees other users' notifications";
  });
  for (const fn of ["merge_colleges", "find_user_id_by_email", "register_college"] as const) {
    await check(role, `cannot call ${fn}() (service role only)`, async () => {
      const args =
        fn === "register_college" ? { p_league_id: REG!, p_poc: {} } : fn === "merge_colleges" ? { p_keep: REG!, p_duplicate: REG! } : { p_email: ADMIN_EMAIL! };
      const { error } = await admin.rpc(fn, args as never);
      return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
    });
  }
}

// ---------- viewer ----------
async function viewerChecks(viewer: SupabaseClient) {
  const role = "viewer";
  for (const t of PRIVATE_TABLES) {
    await check(role, `reads ${t}`, async () => {
      const { error } = await count(viewer, t);
      return error ?? true;
    });
  }
  await check(role, "cannot update registrations", async () => {
    const { data: cur } = await service.from("registrations").select("team_name").eq("id", REG!).single();
    const { data, error } = await viewer.from("registrations").update({ team_name: cur!.team_name }).eq("id", REG!).select("id");
    return denied(error, data);
  });
  await check(role, "cannot insert colleges", async () => {
    const { data, error } = await viewer.from("colleges").insert({ name: "RLS check (should fail)" }).select("id");
    if (data?.length) await service.from("colleges").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "cannot post in a college chat", async () => {
    const { data, error } = await viewer.from("chat_messages").insert({ thread_id: await regThread(), body: "rls-check" }).select("id");
    if (data?.length) await service.from("chat_messages").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "cannot send POC notifications", async () => {
    const { error } = await viewer.rpc("send_poc_notification", { p_title: "x", p_body: null, p_scope: "college", p_registration_id: REG! });
    return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
  });
  await check(role, "cannot upload logos", async () => {
    const { data, error } = await upload(viewer, `registrations/${REG}/rls-check.png`);
    if (data) await service.storage.from("logos").remove([data.path]);
    return error ? true : "uploaded";
  });
  await check(role, "cannot change admin_profiles", async () => {
    const { data, error } = await viewer.from("admin_profiles").update({ role: "admin" }).neq("user_id", "00000000-0000-0000-0000-000000000000").select("user_id");
    return denied(error, data);
  });
}

// ---------- POC ----------
async function pocChecks(poc: SupabaseClient, pocUserId: string) {
  const role = "poc";
  // 0008
  await check(role, "gets its own co-lead links (one per open spot)", async () => {
    const { data, error } = await poc.rpc("my_squad_invites", { p_registration_id: REG! });
    if (error) return error.message;
    const { count: n } = await service.from("contacts").select("*", { count: "exact", head: true }).eq("registration_id", REG!);
    await service.from("squad_invites").delete().eq("registration_id", REG!);
    return data.length === Math.max(0, 3 - (n ?? 0)) ? true : `${data.length} links for ${n} contacts`;
  });
  await check(role, "cannot set Verified or Under review itself", async () => {
    await poc.from("registrations").update({ email_verified_at: new Date().toISOString(), admin_first_viewed_at: new Date().toISOString() }).eq("id", REG!);
    const { data } = await service.from("registrations").select("email_verified_at, admin_first_viewed_at").eq("id", REG!).single();
    return data!.email_verified_at === null && data!.admin_first_viewed_at === null ? true : "set";
  });
  await check(role, "reads only its own registration", async () => {
    const { data, error } = await poc.from("registrations").select("id");
    if (error) return error.message;
    return data.length === 1 && data[0].id === REG ? true : `sees ${data.map((r) => r.id).join(", ") || "nothing"}`;
  });
  for (const t of ["contacts", "participants", "winners"] as const) {
    await check(role, `${t}: only its own registration's rows`, async () => {
      const { data, error } = await poc.from(t).select("registration_id");
      if (error) return error.message;
      const other = data.filter((r) => r.registration_id !== REG);
      return other.length ? `sees ${other.length} rows of other registrations` : true;
    });
  }
  for (const t of ["ambassadors", "admin_profiles", "activity_log"] as const) {
    await check(role, `cannot read ${t}${t === "activity_log" ? " of other registrations" : ""}`, async () => {
      const q = poc.from(t).select("*", { count: "exact", head: true });
      const { count: n, error } = t === "activity_log" ? await q.neq("registration_id", REG!) : await q;
      return error || !n ? true : `sees ${n} rows`;
    });
  }
  await check(role, "college_access: only its own rows", async () => {
    const { data, error } = await poc.from("college_access").select("user_id");
    if (error) return error.message;
    return data.every((r) => r.user_id === pocUserId) ? true : "sees other users' access";
  });
  await check(role, "can update its team name (no-op write)", async () => {
    const { data: cur } = await service.from("registrations").select("team_name").eq("id", REG!).single();
    const { data, error } = await poc.from("registrations").update({ team_name: cur!.team_name }).eq("id", REG!).select("id");
    return error ? error.message : data.length === 1 ? true : "0 rows updated";
  });
  for (const [field, value] of [
    ["participant_count", 999_999],
    ["prize_pool_override", 1],
    ["status", "approved"],
  ] as const) {
    // The POC may update its registration (RLS), but protect_registration_admin_fields (0003) silently keeps the
    // old value of admin-only fields. So judge by what is stored afterwards, read with the service role.
    await check(role, `cannot change ${field} (refused or silently ignored)`, async () => {
      const read = async () => (await service.from("registrations").select(field).eq("id", REG!).single()).data as Record<string, unknown>;
      const before = await read();
      await poc.from("registrations").update({ [field]: value }).eq("id", REG!);
      const after = await read();
      if (after[field] === before[field]) return true;
      await service.from("registrations").update(before as never).eq("id", REG!); // restore, but still fail
      return `VALUE CHANGED: ${String(before[field])} → ${String(after[field])} (restored)`;
    });
  }
  await check(role, "cannot update another registration", async () => {
    const { data: other } = await service.from("registrations").select("id, team_name").neq("id", REG!).limit(1).maybeSingle();
    if (!other) return true;
    const { data, error } = await poc.from("registrations").update({ team_name: other.team_name }).eq("id", other.id).select("id");
    return denied(error, data);
  });
  await check(role, "gets its own invite link", async () => {
    const { data, error } = await poc.rpc("my_invite", { p_registration_id: REG! });
    if (error) return error.message;
    const code = data?.[0]?.code;
    if (code) await service.from("invite_codes").delete().eq("code", code);
    return code && /^[a-z0-9]{10}$/.test(code) ? true : `got ${JSON.stringify(data)}`;
  });
  await check(role, "chat: sees only its own college thread", async () => {
    const { data, error } = await poc.from("chat_threads").select("registration_id, kind");
    if (error) return error.message;
    return data.length === 1 && data[0].registration_id === REG ? true : `sees ${data.length} threads`;
  });
  await check(role, "chat: posts in its own thread (sender set by the database)", async () => {
    const { data, error } = await poc.from("chat_messages").insert({ thread_id: await regThread(), body: "rls-check" }).select("id, sender_id, sender_role");
    if (data?.length) await service.from("chat_messages").delete().eq("id", data[0].id);
    if (error) return error.message;
    return data[0].sender_id === pocUserId && data[0].sender_role === "poc" ? true : `sender ${data[0].sender_id} / ${data[0].sender_role}`;
  });
  await check(role, "chat: cannot spoof the sender", async () => {
    const { data, error } = await poc
      .from("chat_messages")
      .insert({ thread_id: await regThread(), body: "rls-check", sender_role: "admin" } as never)
      .select("id");
    if (data?.length) await service.from("chat_messages").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "chat: cannot post in the Matiks Admins thread", async () => {
    const { data, error } = await poc.from("chat_messages").insert({ thread_id: await adminsThread(), body: "rls-check" }).select("id");
    if (data?.length) await service.from("chat_messages").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "chat: cannot delete messages", async () => {
    const { data, error } = await poc.from("chat_messages").delete().neq("id", "00000000-0000-0000-0000-000000000000").select("id");
    return denied(error, data);
  });
  await check(role, "notifications: reads only its own", async () => {
    const { data, error } = await poc.from("notifications").select("user_id");
    if (error) return error.message;
    return data.every((n) => n.user_id === pocUserId) ? true : "sees other users' notifications";
  });
  await check(role, "cannot send POC notifications", async () => {
    const { error } = await poc.rpc("send_poc_notification", { p_title: "x", p_body: null, p_scope: "college", p_registration_id: REG! });
    return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
  });
  await check(role, "cannot self-register a second college", async () => {
    const { data, error } = await poc.rpc("create_my_registration", {
      p_college_id: null, p_college_name: "RLS check college", p_country: "india", p_college_email: null, p_email_domain: null,
      p_college_logo_url: null, p_club_name: null, p_club_logo_url: null, p_registration_start: "2030-01-01",
      p_league_start: "2030-01-02", p_league_end: "2030-01-03", p_poc_name: "x", p_poc_phone: "9999999999",
    });
    if (data) await service.from("registrations").delete().eq("id", data);
    return error?.code === "P0001" ? true : `got ${error?.code ?? "a registration"}`;
  });
  await check(role, "logos: uploads to its own registration's folder", async () => {
    const { data, error } = await upload(poc, `registrations/${REG}/rls-check-${Date.now()}.png`);
    if (data) await service.storage.from("logos").remove([data.path]);
    return error ? error.message : true;
  });
  await check(role, "logos: not to another registration's folder", async () => {
    const { data: other } = await service.from("registrations").select("id").neq("id", REG!).limit(1).maybeSingle();
    if (!other) return true;
    const { data, error } = await upload(poc, `registrations/${other.id}/rls-check.png`);
    if (data) await service.storage.from("logos").remove([data.path]);
    return error ? true : "uploaded";
  });
  await check(role, "logos: no SVG", async () => {
    const { data, error } = await poc.storage
      .from("logos")
      .upload(`users/${pocUserId}/x.svg`, new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), { contentType: "image/svg+xml" });
    if (data) await service.storage.from("logos").remove([data.path]);
    return error ? true : "uploaded an SVG";
  });
  await check(role, "cannot grant itself access", async () => {
    const { data: other } = await service.from("registrations").select("id").neq("id", REG!).limit(1).maybeSingle();
    if (!other) return true;
    const { data, error } = await poc.from("college_access").insert({ user_id: pocUserId, registration_id: other.id }).select("user_id");
    if (data?.length) await service.from("college_access").delete().eq("user_id", pocUserId).eq("registration_id", other.id);
    return denied(error, data);
  });
}

// ---------- signed up, no college yet ----------
async function strangerChecks(stranger: SupabaseClient, userId: string) {
  const role = "new";
  await check(role, "cannot get another college's invite link", async () => {
    const { error } = await stranger.rpc("my_invite", { p_registration_id: REG! });
    return error?.code === "42501" ? true : `got ${error?.code ?? "a code"}`;
  });
  await check(role, "cannot refresh another college's badges", async () => {
    const { error } = await stranger.rpc("refresh_my_badges", { p_registration_id: REG! });
    return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
  });
  // 0008
  await check(role, "cannot read email verification codes", async () => {
    const { data, error } = await stranger.from("email_verifications").select("*").limit(1);
    return denied(error, data);
  });
  await check(role, "drafts: writes and reads only its own", async () => {
    const { error } = await stranger.from("registration_drafts").upsert({ user_id: userId, data: { step: 1 } });
    if (error) return error.message;
    const other = await stranger.from("registration_drafts").insert({ user_id: "00000000-0000-0000-0000-000000000000", data: {} }).select("user_id");
    const { data } = await stranger.from("registration_drafts").select("user_id");
    await service.from("registration_drafts").delete().eq("user_id", userId);
    if (!other.error) return "wrote someone else's draft";
    return data?.length === 1 && data[0].user_id === userId ? true : `sees ${data?.length} drafts`;
  });
  await check(role, "claim status shows first name + initial only", async () => {
    const { data: reg } = await service.from("registrations").select("college_id").eq("id", REG!).single();
    const { data, error } = await stranger.rpc("college_claim_status", { p_college_ids: [reg!.college_id] });
    if (error) return error.message;
    const extra = [...new Set(data.flatMap((r: object) => Object.keys(r)))].filter((k) => !["college_id", "registration_id", "claimed_by", "status"].includes(k));
    const full = data.some((r) => !/^(\S+( \p{L}\.)?|a Campus Lead)$/u.test(r.claimed_by));
    return extra.length ? `extra columns: ${extra.join(", ")}` : full ? `full name: ${data[0].claimed_by}` : true;
  });
  await check(role, "cannot list another team's co-lead links", async () => {
    const { error } = await stranger.rpc("my_squad_invites", { p_registration_id: REG! });
    return error?.code === "42501" ? true : `got ${error?.code ?? "no error"}`;
  });
  await check(role, "cannot write join requests or co-lead links directly", async () => {
    const a = await stranger.from("join_requests").insert({ registration_id: REG!, user_id: userId, name: "x", email: "x@x" }).select("id");
    const b = await stranger.from("squad_invites").insert({ code: "rlscheck0000", registration_id: REG! }).select("code");
    if (a.data?.length) await service.from("join_requests").delete().eq("id", a.data[0].id);
    if (b.data?.length) await service.from("squad_invites").delete().eq("code", "rlscheck0000");
    return a.error && b.error ? true : "allowed";
  });
  await check(role, "cannot stamp Under review", async () => {
    await stranger.rpc("mark_registration_viewed", { p_registration_id: REG! });
    const { data } = await service.from("registrations").select("admin_first_viewed_at").eq("id", REG!).single();
    return data!.admin_first_viewed_at === null ? true : "stamped";
  });
  const args = (name: string) => ({
    p_college_id: null, p_college_name: name, p_country: "usa" as const, p_college_email: "sports@rlscheck.edu",
    p_email_domain: "rlscheck.edu", p_college_logo_url: null, p_club_name: "RLS Club", p_club_logo_url: null,
    p_registration_start: "2030-01-01", p_league_start: "2030-01-02", p_league_end: "2030-01-03",
    p_poc_name: "RLS Check", p_poc_phone: "9999999999",
  });
  await check(role, "reads nothing private", async () => {
    for (const t of ["registrations", "contacts", "winners", "chat_threads", "chat_messages"] as const) {
      const { n, error } = await count(stranger, t);
      if (!error && n) return `sees ${n} ${t}`;
    }
    return true;
  });
  await check(role, "cannot insert a registration directly", async () => {
    const { data: league } = await service.from("registrations").select("league_id, college_id").eq("id", REG!).single();
    const { data, error } = await stranger.from("registrations").insert({ league_id: league!.league_id, college_id: league!.college_id, poc_email: "x@x" }).select("id");
    if (data?.length) await service.from("registrations").delete().eq("id", data[0].id);
    return denied(error, data);
  });
  await check(role, "logos: uploads only to its own users/ folder", async () => {
    const own = await upload(stranger, `users/${userId}/rls-check.png`);
    if (own.data) await service.storage.from("logos").remove([own.data.path]);
    if (own.error) return `own folder refused: ${own.error.message}`;
    const other = await upload(stranger, `users/00000000-0000-0000-0000-000000000000/rls-check.png`);
    if (other.data) await service.storage.from("logos").remove([other.data.path]);
    return other.error ? true : "uploaded to someone else's folder";
  });
  // Creates ONE pending registration (a throwaway USA college), checks it, then deletes it.
  let created: { registration?: string; college?: string } = {};
  await check(role, "creates exactly one pending registration for itself", async () => {
    const { data, error } = await stranger.rpc("create_my_registration", args(`RLS Check College ${userId.slice(0, 8)}`));
    if (error?.code === "P0001" && /closed/i.test(error.message)) return true; // registrations closed: nothing to create
    if (error) return `${error.code}: ${error.message}`;
    const { data: r } = await service.from("registrations").select("status, created_by, college_id").eq("id", data).single();
    created = { registration: data, college: r!.college_id };
    const { count: access } = await service.from("college_access").select("*", { count: "exact", head: true }).eq("registration_id", data).eq("user_id", userId);
    if (r!.status !== "pending" || r!.created_by !== userId || access !== 1) return `status ${r!.status}, access ${access}`;
    const second = await stranger.rpc("create_my_registration", args("RLS Check College 2"));
    if (second.data) await service.from("registrations").delete().eq("id", second.data);
    return second.error?.code === "P0001" ? true : "a second registration was allowed";
  });
  await check(role, "cannot approve its own registration", async () => {
    if (!created.registration) return true;
    await stranger.from("registrations").update({ status: "approved", stage_override: "live" }).eq("id", created.registration);
    const { data } = await service.from("registrations").select("status, stage_override").eq("id", created.registration).single();
    return data!.status === "pending" && data!.stage_override === null ? true : `now ${data!.status} / ${data!.stage_override}`;
  });
  if (created.registration) await service.from("registrations").delete().eq("id", created.registration);
  if (created.college) await service.from("colleges").delete().eq("id", created.college);
}

// ---------- run ----------
const temp: string[] = [];
const sessions: SupabaseClient[] = [];
const signedIn = async (email: string) => {
  const c = await sessionFor(email);
  sessions.push(c);
  return c;
};
try {
  await anonChecks();
  await adminChecks(await signedIn(ADMIN_EMAIL));

  if (TEMP_USERS) {
    const tag = Math.random().toString(36).slice(2, 8);
    const mk = async (kind: string) => {
      const email = `rls-check-${kind}-${tag}@example.com`;
      const { data, error } = await service.auth.admin.createUser({ email, email_confirm: true });
      if (error) throw error;
      temp.push(data.user.id);
      return { email, id: data.user.id };
    };
    const viewer = await mk("viewer");
    const { error: ve } = await service.from("admin_profiles").insert({ user_id: viewer.id, email: viewer.email, role: "viewer", name: "RLS check" });
    if (ve) throw ve;
    const poc = await mk("poc");
    const { error: pe } = await service.from("college_access").insert({ user_id: poc.id, registration_id: REG });
    if (pe) throw pe;

    const stranger = await mk("new");

    await viewerChecks(await signedIn(viewer.email));
    await pocChecks(await signedIn(poc.email), poc.id);
    await strangerChecks(await signedIn(stranger.email), stranger.id);
  }
} finally {
  // End the minted sessions so no refresh tokens are left behind.
  for (const c of sessions) await c.auth.signOut({ scope: "local" });
  for (const id of temp) {
    await service.from("college_access").delete().eq("user_id", id);
    await service.from("admin_profiles").delete().eq("user_id", id);
    await service.from("notifications").delete().eq("user_id", id);
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error(`Couldn't delete temp user ${id}: ${error.message}`);
  }
}

const width = Math.max(...results.map((r) => r.check.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.role.padEnd(6)}  ${r.check.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed${TEMP_USERS ? "" : " (viewer and POC skipped; add --temp-users)"}`);
process.exit(failed ? 1 : 0);

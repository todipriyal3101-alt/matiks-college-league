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

const PRIVATE_TABLES = ["registrations", "contacts", "participants", "winners", "ambassadors", "admin_profiles", "college_access", "activity_log"] as const;

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
  await check(role, "cannot change admin_profiles", async () => {
    const { data, error } = await viewer.from("admin_profiles").update({ role: "admin" }).neq("user_id", "00000000-0000-0000-0000-000000000000").select("user_id");
    return denied(error, data);
  });
}

// ---------- POC ----------
async function pocChecks(poc: SupabaseClient, pocUserId: string) {
  const role = "poc";
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
    await check(role, `cannot change ${field}`, async () => {
      const { data: before } = await service.from("registrations").select(field).eq("id", REG!).single();
      const { data, error } = await poc.from("registrations").update({ [field]: value }).eq("id", REG!).select("id");
      if (!error && data?.length) {
        await service.from("registrations").update(before as never).eq("id", REG!); // revert
        return "ALLOWED (reverted)";
      }
      return true;
    });
  }
  await check(role, "cannot update another registration", async () => {
    const { data: other } = await service.from("registrations").select("id, team_name").neq("id", REG!).limit(1).maybeSingle();
    if (!other) return true;
    const { data, error } = await poc.from("registrations").update({ team_name: other.team_name }).eq("id", other.id).select("id");
    return denied(error, data);
  });
  await check(role, "cannot grant itself access", async () => {
    const { data: other } = await service.from("registrations").select("id").neq("id", REG!).limit(1).maybeSingle();
    if (!other) return true;
    const { data, error } = await poc.from("college_access").insert({ user_id: pocUserId, registration_id: other.id }).select("user_id");
    if (data?.length) await service.from("college_access").delete().eq("user_id", pocUserId).eq("registration_id", other.id);
    return denied(error, data);
  });
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

    await viewerChecks(await signedIn(viewer.email));
    await pocChecks(await signedIn(poc.email), poc.id);
  }
} finally {
  // End the minted sessions so no refresh tokens are left behind.
  for (const c of sessions) await c.auth.signOut({ scope: "local" });
  for (const id of temp) {
    await service.from("college_access").delete().eq("user_id", id);
    await service.from("admin_profiles").delete().eq("user_id", id);
    const { error } = await service.auth.admin.deleteUser(id);
    if (error) console.error(`Couldn't delete temp user ${id}: ${error.message}`);
  }
}

const width = Math.max(...results.map((r) => r.check.length));
for (const r of results) console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.role.padEnd(6)}  ${r.check.padEnd(width)}  ${r.detail}`);
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed} passed, ${failed} failed${TEMP_USERS ? "" : " (viewer and POC skipped; add --temp-users)"}`);
process.exit(failed ? 1 : 0);

# Build phases — prompts for Claude Code

Run one phase per Claude Code session. Shortcut: type `/phase 1`, `/phase 2` … in Claude Code
(the custom command in `.claude/commands/phase.md` reads the matching section below).

After every phase: `npm run dev`, click through it, then `git add . && git commit -m "phase N" && git push`.

---

## Phase 1 — Skeleton

Read CLAUDE.md and docs/SPEC.md. The Next.js project already exists (created with create-next-app,
TypeScript, Tailwind, App Router, src/ dir, alias @/*).

1. Install: @supabase/supabase-js @supabase/ssr zod react-hook-form @hookform/resolvers.
2. Initialise shadcn/ui and add: button, input, label, select, textarea, card, form, table, badge,
   dialog, dropdown-menu, sonner, tabs, checkbox, separator, skeleton.
3. Create `src/lib/supabase/client.ts` (browser), `server.ts` (server with cookies via @supabase/ssr)
   and `admin.ts` (service role, with `import "server-only"` at the top; install `server-only`).
4. Create `src/proxy.ts` (Next.js 16 name for middleware; export `proxy`) that refreshes the Supabase session on every request (official @supabase/ssr pattern).
5. Create placeholder pages: `/` , `/register`, `/register/success`, `/my`, `/colleges`,
   `/admin/login`, `/admin`. Each just shows its title.
6. Add a simple public header/footer layout for public pages.
7. Run `npm run build` and fix all errors.

---

## Phase 2 — Database types and data helpers

The schema is in `supabase/migrations/0001_init.sql` and is already applied to the live project.
1. Write `src/lib/database.types.ts` by hand from the migrations, in the standard Supabase generated-types format
   (Tables with Row/Insert/Update, Enums, Functions). The Supabase CLI is not linked, so don't run `supabase gen types`.
2. Type the three Supabase clients with `Database`.
3. Create `src/lib/data/leagues.ts` with `getActiveLeague()` (the most recent league with status
   'upcoming' or 'live') and `src/lib/data/colleges.ts` with `searchColleges(query)` (max 10, by name or short_name, ilike).
   Both read through a cookie-free public client (`src/lib/supabase/public.ts`).
   `getActiveLeague()` is cached (`"use cache"`) and tagged `"league"`; also add an uncached `getActiveLeagueFresh()`.
4. Create an API route `GET /api/colleges/search?q=` that returns `searchColleges` results (id, name, short_name, city, state).
   Never cached, so a college added by one student is found by the next.
5. Run `npm run build`.

---

## Phase 3 — Student landing page + registration form

Read the "Student panel" section of docs/SPEC.md.
1. Landing page `/`: hero with league name from getActiveLeague(), prize pool, format, timeline,
   FAQ (accordion), big "Register your college" button. Leave clear TODO placeholders for copy I'll provide.
2. On first visit, store utm_source, utm_medium, utm_campaign, utm_content and ref from the URL in a
   30-day cookie (do this in `src/proxy.ts` so it works on any landing URL).
3. `/register`: 4-step form with react-hook-form + zod (schema in `src/lib/validation/registration.ts`):
   step 1 college (type-ahead using /api/colleges/search, or "My college isn't listed" → name, city, state, type);
   step 2 POC (name, email, 10-digit Indian mobile, year, course, Matiks username);
   step 3 team name + teammates (add/remove rows; optional);
   step 4 review + consent checkbox + Cloudflare Turnstile widget.
   Progress bar, back/next, keeps data between steps, works perfectly at 375px.
4. Server action `submitRegistration` in `src/app/register/actions.ts`:
   validate with the same zod schema; verify Turnstile with TURNSTILE_SECRET_KEY; check the active league
   has registration_open (read with `getActiveLeagueFresh()`, never the cached `getActiveLeague()`); find-or-create the college (by normalized name); if a registration already exists
   for this college + league return an "already registered" result with the POC's first name only;
   insert registration (pending) + POC contact + participants using the admin client; read UTM/ref from the cookie.
5. Redirect to `/register/success?id=<registration id>` showing the ID, next steps and share buttons
   (WhatsApp, LinkedIn, X, copy link) with a pre-filled message.
6. If registration is closed, `/register` shows a friendly "Registrations closed" message.
7. Run `npm run build`.

---

## Phase 4 — Admin login + layout

Read the "Admin panel" and "Security" sections of docs/SPEC.md.
1. `/admin/login`: email + password login, and "Continue with Google" (Supabase Auth).
2. In `src/proxy.ts`: every `/admin/*` route except `/admin/login` requires a logged-in user who has a row in
   `admin_profiles`; otherwise redirect to `/admin/login` (show "You don't have admin access" if logged in but not listed).
3. Admin layout: sidebar (Dashboard, Registrations, Colleges, Participants, Ambassadors, Leagues, Matches,
   Team, Import), top bar with season picker (stored in a `league` search param or cookie) and user menu with logout.
4. `src/lib/auth/admin.ts`: `requireAdmin()` and `requireAdminWriter()` helpers for server actions/components.
   Viewers never see edit/approve/export buttons, and server actions reject them.
5. Run `npm run build`.

---

## Phase 5 — Design system (Lovable dark theme)

Read "League operations > Design" in docs/SPEC.md. Reference: /tmp/lovable-ref/src/styles.css,
src/components/status-badges.tsx, src/components/app-shell.tsx (read only; don't copy code).
1. `src/app/globals.css`: Lovable's tokens as the only theme (dark, no light mode): background/card/primary
   `oklch(0.68 0.22 295)`/muted/border…, status pill tokens (`--status-registration|live|pending|done` + `-fg`),
   chart tokens, `glow` utility. Remove the `--brand-*` TODO placeholders.
2. Fonts with `next/font/google`: Space Grotesk (headings, `font-display`), Inter (body), JetBrains Mono (`font-mono`, numbers).
3. `src/lib/league.ts`: STAGES + labels (Registration / Live / Prize pending / Complete), REVIEW_STATUSES + labels,
   PRIZE_TIERS, `calcPrizePool()`, `effectivePrizePool()`, `formatINR()` (₹1,00,000 via `en-IN`).
4. `src/components/league/`: `StageBadge`, `ReviewBadge`, `PillBadge` (ok/pending), `Money` (mono ₹), `StatCard`,
   `EmptyState`, `CopyButton`.
5. Add shadcn: alert-dialog, switch, sheet, command, popover, tooltip, tabs (if missing).
6. Restyle the public site (header, footer, landing, /register, success) and the admin shell (sidebar, top bar,
   login) to the new look. Lovable's logo block (Sigma icon) in both headers, named "Matiks College League"
   (never "MatiksLined" / "Matiks League Manager").
7. CLAUDE.md rule 8 → the tokens and fonts above. Check every student page at 375px.
8. Run `npm run build`.

---

## Phase 6 — Database: league operations (migration 0003) + data layer

Read "League operations" in docs/SPEC.md (all of it). Reference: /tmp/lovable-ref/supabase/migrations.
1. `supabase/migrations/0003_league_ops.sql`, exactly as specified in SPEC "League operations > Database objects":
   - `registration_stage` enum + `registrations.stage` (default registration_phase), `participant_count int >= 0
     default 0`, `prize_pool_override int null (>= 0)`; `calc_prize_pool(int)` immutable.
   - `tshirt_size` enum (XS–XXL); contacts: `is_primary`, `tshirt_size`, `address`, `pincode`, `merch_description`,
     `merch_sent`, `merch_sent_at`. Backfill the earliest 'poc' contact per registration as primary; unique partial
     index (one primary per registration); trigger: max 3 contacts, first contact becomes primary.
   - `prize_type` enum (cash, cash_plus_merch, merch_only); `winners` table (fields in SPEC) with updated_at trigger.
   - `college_access (user_id, registration_id, invited_by, created_at)`, unique (user_id, registration_id).
     `is_registration_poc()` = college_access row OR poc_email match.
   - `activity_log` written only by triggers (security definer) — registration status/stage/participant_count/
     prize_pool_override; winner insert + payment_status/prize_amount/merch_sent/upi_id; contact merch_sent.
     Admins read all, POCs read their own, no INSERT/UPDATE/DELETE grants or policies for clients.
   - View `registration_overview` with `security_invoker = true` (columns in SPEC).
   - `find_user_id_by_email(text)` security definer, EXECUTE only to service_role.
   - Guards with the `auth.role() = 'authenticated' and not is_admin_writer()` pattern: extend
     `protect_registration_admin_fields` (stage, participant_count, prize_pool_override); contact merch fields +
     is_primary + can't delete primary; winner admin fields forced to defaults on insert / kept on update; paid
     winners: non-admin update raises, delete blocked by RLS; `paid_at` / `merch_sent_at` set automatically.
   - RLS + explicit grants on every new table and the view; anon gets nothing.
2. Hand-update `src/lib/database.types.ts` (tables, view, enums, functions).
3. **Test on a local Postgres before handing it over**: a throwaway database with Supabase shims (auth schema,
   `auth.uid()` / `auth.jwt()` / `auth.role()` from `request.jwt.claims`, roles anon/authenticated/service_role),
   run 0001 → 0002 → 0003, then a scripted test as **POC, admin, viewer and anon** covering every rule above.
   Show me the results table.
4. **Stop**: give me the SQL to paste into the Supabase SQL Editor and wait for my OK (Deploy rule).
5. Data layer (after my OK): `src/lib/data/league-ops.ts` — `getOverview(leagueId, filters)`,
   `getRegistrationDetail(id)` (registration + college + contacts + winners + activity), `getMyRegistrations()`;
   zod schemas in `src/lib/validation/league-ops.ts`. Run `npm run build`.

---

## Phase 7 — League Overview (/admin)

Read SPEC "League operations > Screens" (/admin row). Reference: /tmp/lovable-ref/src/routes/_authenticated/admin/index.tsx.
1. `/admin` = League Overview for the season in the picker: title "League Overview"; stat cards Colleges, Prize
   committed, Prize paid out, Live now, Pending review (from `registration_overview`).
2. Colleges table (TanStack Table): college, review status, stage, participants, prize pool + "override" tag,
   primary POC, winners paid X/Y, POC merch X/Y, source; row click → editor. Cards instead of the table below `md`.
3. Search + filters (review status, stage, source) + sort, all synced to the URL search params.
4. ⋯ menu: Manage, Copy link, Approve / Waitlist / Reject, Invite POC (dialog, phase 9 wires the email),
   Delete (AlertDialog, type the college name to confirm). Viewers see Manage + Copy link only.
5. Bulk: row checkboxes → Approve / Reject / Change stage, optimistic with an Undo toast.
6. "Add college" dialog: pick an existing college (type-ahead) or a new one + primary POC name, phone, email
   → `register_college` for this season (review status approved).
7. Export the filtered view to Excel and CSV (admins only; server action re-checks the role).
8. Empty states and skeletons. Old `/admin/registrations` and `/admin/colleges` list redirect to `/admin`.
9. Server actions: `requireAdminWriter()` on every write, `requireAdmin()` on reads. Run `npm run build`.

---

## Phase 8 — College editor (/admin/colleges/[registrationId])

Read SPEC "League operations" (Prize pool, Contacts, Winners, Activity log, UX rules).
Reference: /tmp/lovable-ref/src/components/college-editor.tsx.
1. `src/components/league/college-editor/` — one `CollegeEditor` with `mode: "admin" | "poc"`:
   - Header: college name, review status, stage, participants, prize pool override, "Auto tier ₹X → Effective ₹Y",
     "Manually overridden" tag. Admin edits stage/participants/override/review status; POC edits team name only.
   - Contact cards (max 3, ★ primary, add/remove non-primary), T-shirt select, address, pincode; admin-only
     "Merch owed" + Sent switch; POCs see the Sent/Pending pill.
   - Winners table with expandable rows (email, matiks username, T-shirt, address, pincode, prize type, merch);
     copy buttons for UPI and phone; admin Paid / Merch switches; "Mark paid" dialog asks for the UTR;
     lock icon + read-only row for POCs on paid winners.
   - Participants: read-only list of the registration's players (name, Matiks username, year), with a count.
   - Activity timeline ("Ananya marked 1st place paid · UTR … · 2h ago").
2. One react-hook-form for team name + contacts + winner details with a sticky "Unsaved changes · Discard · Save"
   bar; admin toggles (paid, merch, stage) save immediately, optimistic, with Undo.
3. Server actions in `src/app/admin/(panel)/colleges/[registrationId]/actions.ts` using the **user's** Supabase
   client so RLS + triggers enforce the rules (admin client only where SPEC says so). Validate with zod.
4. AlertDialog for deletes; empty states ("No winners yet — add the 1st place"). Run `npm run build`.

---

## Phase 9 — Manage access + auth

Read SPEC "League operations > Access". Reference: /tmp/lovable-ref/src/routes/_authenticated/admin/access.tsx,
src/routes/auth.tsx, src/routes/reset-password.tsx.
1. `/admin/team` = "Manage Access": invite Admin / Viewer / College POC (POC: pick a registration from the selected
   season); list (email, role, college, last sign-in, invited by); resend invite; revoke (AlertDialog; never yourself).
   Lookup with `find_user_id_by_email`, else `auth.admin.inviteUserByEmail` with redirectTo
   `/auth/callback?next=/college` (POC) or `next=/admin`. Upsert `admin_profiles` / `college_access`.
2. "Approve + invite POC" in the overview ⋯ menu and editor: approves, then invites the registration's poc_email.
3. One `/login` for everyone: password, magic link, "Forgot password?" → email → `/reset-password`.
   `/admin/login` redirects to `/login`. No sign-up. After login: admins → /admin, POCs → /college,
   others → `/no-access` (logout button).
4. `/auth/callback` handles both `code` (OAuth/PKCE) and `token_hash` + `type` (invite, magiclink, recovery) so
   emailed links work with server-side auth; tell me which Supabase email templates to change.
5. Proxy: `/college` needs a login; `/admin/*` unchanged. Run `npm run build`.

---

## Phase 10 — POC portal (/college)

1. `/college`: the logged-in POC's registrations (college_access or poc_email); season switch if several;
   `CollegeEditor mode="poc"` for the selected one. Phone-first (375px), big touch targets.
2. `/my` → redirect to `/college`; success page and emails link to `/college`.
3. Empty state when they have access but nothing this season. Run `npm run build`.

---

## Phase 11 — Insights, ambassadors, seasons, matches

1. Migration `0004_insights.sql`: SQL functions (security invoker) for a league_id: registrations per day,
   by utm_source, by state, top 10 referral codes with ambassador name; plus `merge_colleges(keep, duplicate)`
   (step 6). Test on the local Postgres, then stop for the SQL Editor (Deploy rule).
2. /admin "Insights" tab: line chart (per day), bar charts (source, state), top ambassadors table. Recharts.
3. `/admin/ambassadors`: add/edit, auto-generate a unique referral code, copy link (`/register?ref=CODE`),
   QR code (`qrcode`), signups per code.
4. `/admin/leagues` ("Seasons"): create/edit season, dates, deadline, max colleges, status, open/close
   registration — every action calls `updateTag(CACHE_TAGS.league)`.
5. `/admin/matches`: fixtures between approved colleges of the season, scores, winner; public `/fixtures`.
6. **"Merge into…"** (admin writers): on the college editor's ⋯ menu, pick the college to keep (type-ahead over
   all colleges); preview what moves; registrations, matches (college_a/b, winner) and ambassadors move to the
   kept college, then the duplicate is deleted — in one transaction (SQL function in 0004, service_role only).
   If both colleges registered for the same season, block with a clear message (resolve one registration first).
7. Public `/colleges` wall (approved colleges: name, city, logo). Sidebar: drop Participants and Import
   (participants live in the college editor; Import is in the Backlog). Run `npm run build`.

---

## Phase 12 — Emails + polish

1. Resend (`src/lib/email.ts`): registration confirmation; review status change; "you've been invited";
   winner marked paid (with UTR). Branded to the dark theme.
2. Ctrl/⌘+K command palette in admin (colleges of the season, pages, actions).
3. `opengraph-image.tsx` for `/` and `/register` (league name, prize pool, deadline), metadata, `sitemap.ts`,
   `robots.ts`; Vercel Analytics + `college_registered` event.
4. Pass over every screen: skeletons, empty states, Undo toasts, AlertDialogs, 375px. Run `npm run build`.

---

## Phase 13 — Test and harden

1. `scripts/rls-check.ts`: as anon, POC, viewer and admin, confirm what each can read/write on every table and the
   view (same matrix as Phase 6) against the real project.
2. Confirm the service role key never appears in client bundles (search `.next/static`).
3. Confirm every server action calls requireAdmin / requireAdminWriter / requirePoc.
4. Rate limiting on submitRegistration and the login/magic-link/invite actions.
5. End-to-end at 375px: register → approve + invite → POC accepts → edits contacts/winners → admin marks paid.
6. Run `npm run build` and list everything you changed.

---

## Backlog (not scheduled)

- `/admin/import` (CSV of past seasons' colleges and participants).

---

## Before launch

Follow-ups deferred from Phase 3 — must be done before registrations open publicly.

- [ ] **Confirmation email** on submitRegistration (Resend; Phase 12 step 1).
- [ ] **Rate limiting** on submitRegistration — max 5 per email/phone per hour (Phase 13 step 4).
- [ ] Lovable dark theme applied everywhere (Phase 5; CLAUDE.md rule 8).
- [ ] Replace every `TODO` in landing copy (`src/app/(public)/content.ts`), success page and form
      (rules/privacy links, support contact, Matiks app link, social links).
- [ ] Real Turnstile keys in Vercel (`NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`) and
      `NEXT_PUBLIC_SITE_URL` set to the production domain.
- [ ] Supabase email templates (invite, magic link, recovery) point at `/auth/callback` (Phase 9).
- [ ] Resend: verify the sending domain, then set `RESEND_API_KEY` and `EMAIL_FROM` in Vercel. Without the key no
      league emails go out (they're logged as skipped) and invites fall back to Supabase's own invite email.
- [ ] Supabase Auth > "Allow new users to sign up" is **off** (POCs only get in through Approve + invite).
- [ ] Delete the "ZZ Test College" test registration.
- [ ] Active league row: status `upcoming`/`live`, `registration_open = true`, `registration_deadline` set.

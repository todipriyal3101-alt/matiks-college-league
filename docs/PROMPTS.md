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

## Phase 5 — Registrations + colleges

1. `/admin/registrations`: TanStack Table for the selected season — columns: college, state, POC name,
   POC phone, participants count, source, referral, status (badge), submitted at. Search, filters (status,
   state, source, date range), sorting, pagination, row checkboxes, bulk Approve / Waitlist / Reject.
2. Detail page `/admin/registrations/[id]`: college, all contacts, participants, source info, status
   change with reviewed_by/reviewed_at, admin notes.
3. `/admin/colleges`: master list with search; college page showing every season it played, contacts,
   results; "Merge into…" tool that moves registrations/matches from a duplicate college to the chosen one, then deletes the duplicate.
4. Export to Excel (use the `xlsx` package) and CSV buttons that export the current filtered view (admins only).
5. Run `npm run build`.

---

## Phase 6 — Dashboard

1. New migration `0002_dashboard.sql` with SQL functions (security invoker, admin-only via RLS) that
   return, for a league_id: totals (colleges, approved colleges, participants, states covered, pending),
   registrations per day, registrations by utm_source, by state, and top 10 referral codes with ambassador name.
2. `/admin` dashboard: stat cards, line chart (per day), bar charts (source, state), top ambassadors table. Recharts.
3. Stop and tell me to paste the migration into Supabase SQL Editor and run it; wait for my confirmation before pushing the code.
4. Run `npm run build`.

---

## Phase 7 — Ambassadors, leagues, matches, participants, team

1. `/admin/ambassadors`: add/edit ambassador, auto-generate a short unique referral code, copy link
   (`/register?ref=CODE`), QR code (use `qrcode`), signups count per code.
2. `/admin/leagues`: create/edit season, dates, deadline, max colleges, status, open/close registration toggle.
   Every league-changing server action calls `updateTag(CACHE_TAGS.league)` so the public site updates immediately.
3. `/admin/matches`: create fixtures between approved colleges of the season, enter scores, set winner.
4. `/admin/participants`: all players across colleges for the season; filter; highlight missing Matiks usernames.
5. `/admin/team`: list admins, add by email (user must exist in auth), set admin/viewer, remove.
6. Public `/colleges` (approved colleges: name, city, logo) and `/fixtures` pages.
7. Run `npm run build`.

---

## Phase 8 — My registration, emails, sharing polish

1. `/my`: magic-link login (Supabase OTP email). After login, show registrations where poc_email matches,
   status badge, edit team name and teammates until the league's registration_deadline (RLS already allows this).
2. Emails with Resend (`src/lib/email.ts`): confirmation on submit; email to POC when an admin changes status.
3. `opengraph-image.tsx` for `/` and `/register` (1200x630, league name, prize pool, deadline),
   metadata titles/descriptions, `sitemap.ts`, `robots.ts`.
4. Install Vercel Analytics.
5. `/admin/import`: upload a CSV of past colleges/participants, preview rows, map columns, import.
6. Run `npm run build`.

---

## Phase 9 — Test and harden

1. Write `scripts/rls-check.ts` that uses the anon key to try selecting from every table and confirms
   registrations, contacts, participants, ambassadors and admin_profiles return 0 rows.
2. Confirm the service role key never appears in client bundles (search `.next/static`).
3. Confirm every admin server action calls requireAdmin/requireAdminWriter.
4. Add rate limiting to submitRegistration (max 5 per email/phone per hour; simple table or Upstash).
5. Test the full registration flow at 375px and fix layout issues.
6. Run `npm run build` and list everything you changed.

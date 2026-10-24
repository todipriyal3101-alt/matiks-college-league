@AGENTS.md

# Matiks College League Portal

Website for Matiks' inter-college mind sports league (one league, run season by season).
Two panels, one Next.js app, one Supabase database:

- **POC panel (/college)** — POCs create an account at `/login`, then Register (their one pending registration),
  Chat with Matiks, Winners, Profile & contacts. No public landing page: `/` routes by role.
- **Admin panel (/admin, private)** — Overview (India/USA), registered colleges (approve/deny), Search, Chats, POCs
  (notifications), college editor, Manage Admins, league tools (Seasons, Matches, Ambassadors), Excel export.

Full product spec: `docs/SPEC.md`. Build phases and prompts: `docs/PROMPTS.md`.
Always read the relevant part of SPEC.md before building a feature.

## Stack

- Next.js (App Router) + TypeScript, `src/` directory, import alias `@/*`
- Tailwind CSS + shadcn/ui components
- Supabase: Postgres, Auth, Storage (project region: Mumbai)
- Forms: react-hook-form + zod (same zod schema on client and server)
- Emails: Resend. Realtime: Supabase Realtime (chat, notifications). Logos: Supabase Storage bucket `logos`
- Captcha: Cloudflare Turnstile on every /login action, verified by Supabase Auth (Attack Protection › Captcha)
- Hosting: Vercel, auto-deploys from GitHub `main`

## Folder conventions

- `src/app/college/...` — POC panel; `src/app/(public)/...` — unlinked public pages (/colleges, /fixtures)
- `src/app/admin/...` — admin pages (protected by `src/proxy.ts`)
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server, user session), `admin.ts` (service role, server only),
  `public.ts` (cookie-free anon client for public data; safe inside `"use cache"`)
- `src/lib/data/` — data helpers (`leagues.ts`, `colleges.ts`)
- `src/lib/database.types.ts` — DB types, **hand-written** from the migrations (see rule 11)
- `src/lib/cache-tags.ts` — cache tag names
- `src/lib/validation/` — zod schemas
- `src/components/ui/` — shadcn components (restyled as glass); `src/components/` — app components;
  `src/components/glass.tsx` — `<Glass>` + the refraction filter
- `supabase/migrations/` — numbered SQL migrations; `supabase/seed.sql` — sample data

## Rules (always follow)

1. **Database changes only through new migration files** in `supabase/migrations/`
   (`000N_short_name.sql`). Never edit an applied migration; add a new one.
2. **RLS is on for every table.** Every new table gets RLS enabled and explicit policies in the same migration.
3. **The service role key is server-only.** Only import `src/lib/supabase/admin.ts` from server actions,
   route handlers or server components. Never from a file with `"use client"`.
4. **Every admin server action checks the role** with `is_admin()` / `is_admin_writer()` before doing anything.
   Viewers can read but never write or export.
5. **Validate on the server** with zod even when the form already validated.
6. **Mobile-first.** Students arrive from Instagram/WhatsApp on phones. Test every student page at 375px wide.
7. **Never show student phone numbers or emails on public pages.**
8. **Design = the matiks.com look + Liquid Glass** on the whole site (SPEC "League operations > Design"): tokens in
   `src/app/globals.css` (#1a1a1a background with one soft static gradient — no grid, no blobs; lime primary
   `#b1fa63` with the raised `edge`, lilac accent, status pill tokens with Live in teal), Bebas Neue for h1/h2,
   Montserrat UI, Nunito Sans paragraphs, Space Mono numbers; brand files in `public/brand/`. Glass surfaces only via
   `<Glass>` or the `glass` / `glass-strong` / `glass-surface` / `glass-refract` utilities; `glass-surface` (no blur)
   for list rows. Mascot on public pages only. Money via `formatMoney(amount, country)` (₹ Indian format / $).
   Decorative stickers (`public/brand/stickers`, `src/components/stickers.tsx`) only in a few empty states, the home hero,
   one beside the /login card, the registration stepper's reacting trophy (stands in for the mascot outside public pages)
   and the approval celebration; never in the side gutters of any page; aria-hidden, no motion when reduced.
9. Before saying a task is done: run `npm run build` and fix every error and type error.
10. Keep each change small and focused; explain what you changed at the end in a short list.
11. **DB types are hand-written.** The Supabase CLI is not linked, so `src/lib/database.types.ts` is written by hand
    from `supabase/migrations/*.sql` in the standard `supabase gen types` format. Update it in the same change as
    any migration that adds or alters tables, columns, enums or functions.
12. **Caching (Cache Components is on).**
    - Public league data (`getActiveLeague()`) is cached with `"use cache"` and tagged `CACHE_TAGS.league`.
      Every server action that changes a league (edit, open/close registration, status) must call
      `updateTag(CACHE_TAGS.league)` so the change shows immediately (`revalidateTag(tag, { expire: 0 })` in route handlers).
    - POC self-registration is always open (migration 0006): never gate it on a season's `registration_open` or
      deadline. The only switch is `app_settings.registrations_paused` ("Pause new registrations" in Seasons), read
      uncached with `getRegistrationsPaused()`; `create_my_registration()` picks the season itself.
    - `/api/colleges/search` is never cached (dynamic + `Cache-Control: no-store`), so newly added colleges appear at once.

13. **League operations follow docs/SPEC.md "League operations".** Everything there is per registration
    (one college in one season). Admin-only fields, paid-winner locks and the activity log are enforced in the
    database (triggers + RLS), not only in the UI — never rely on hiding a button. Reference UI: the Lovable export
    unzipped to `/tmp/lovable-ref` (re-unzip `~/Desktop/lovable-project-*.zip` without its `.env` if missing);
    match its screens and wording, never copy its code or the bugs listed in SPEC.

## Deploy rule

The Supabase CLI is **not linked** on this machine — never run `npx supabase db push` or `supabase gen types`.
Migrations are applied by hand in the Supabase SQL Editor.

When a phase adds a migration file:
1. **Stop** and tell me to paste the full contents of `supabase/migrations/000N_name.sql` into
   Supabase Dashboard > SQL Editor and run it.
2. **Wait for me to confirm** it ran successfully before continuing (no further code that depends on it,
   no commit/push).
3. The migration must be applied to the live database **before** code that depends on it is pushed to `main`,
   or the live site breaks.

## Commands

- `npm run dev` — local dev server at http://localhost:3000
- `npm run build` — production build (must pass)
- Migrations: paste into Supabase Dashboard > SQL Editor and run (see Deploy rule) — the CLI is not linked
- DB types: no generator — edit `src/lib/database.types.ts` by hand after each migration (rule 11)

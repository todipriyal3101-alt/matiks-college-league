@AGENTS.md

# Matiks College League Portal

Website for Matiks' inter-college mind sports league (Brumble and future seasons).
Two panels, one Next.js app, one Supabase database:

- **Student panel (public)** — landing page, 4-step college registration form, success page,
  "My registration" page (magic-link login), public colleges wall and fixtures.
- **Admin panel (/admin, private)** — dashboard, registrations review, colleges, participants,
  ambassadors, leagues (seasons), matches, team management, Excel/CSV exports.

Full product spec: `docs/SPEC.md`. Build phases and prompts: `docs/PROMPTS.md`.
Always read the relevant part of SPEC.md before building a feature.

## Stack

- Next.js (App Router) + TypeScript, `src/` directory, import alias `@/*`
- Tailwind CSS + shadcn/ui components
- Supabase: Postgres, Auth, Storage (project region: Mumbai)
- Forms: react-hook-form + zod (same zod schema on client and server)
- Admin tables: TanStack Table. Charts: Recharts. Emails: Resend. Captcha: Cloudflare Turnstile
- Hosting: Vercel, auto-deploys from GitHub `main`

## Folder conventions

- `src/app/(public)/...` — student-facing pages
- `src/app/admin/...` — admin pages (protected by `src/proxy.ts`)
- `src/lib/supabase/` — `client.ts` (browser), `server.ts` (server, user session), `admin.ts` (service role, server only)
- `src/lib/validation/` — zod schemas
- `src/components/ui/` — shadcn components; `src/components/` — app components
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
8. Matiks brand: primary colour `#______`, accent `#______`, font `______` (fill in).
9. Before saying a task is done: run `npm run build` and fix every error and type error.
10. Keep each change small and focused; explain what you changed at the end in a short list.

## Deploy rule

Apply new migrations to the live database (`npx supabase db push`) **before** pushing code that
depends on them to `main`, or the live site breaks.

## Commands

- `npm run dev` — local dev server at http://localhost:3000
- `npm run build` — production build (must pass)
- `npx supabase db push` — apply migrations to the linked Supabase project
- `npx supabase gen types typescript --linked > src/lib/database.types.ts` — regenerate DB types after a migration

# Setup — from zero to Claude Code (about 30 minutes)

Run these in your terminal, in order.

## 1. Accounts (browser)

- GitHub: create an empty repo `matiks-college-league` (no README)
- Supabase: new project `matiks-college-league`, region **Mumbai (ap-south-1)**, save the DB password
- Vercel: you'll import the repo in step 7
- Cloudflare Turnstile and Resend: can wait until Phase 3 / Phase 8

## 2. Create the Next.js project

```bash
npx create-next-app@latest matiks-college-league --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
cd matiks-college-league
```

## 3. Copy the starter files in

Unzip `matiks-league-starter.zip` and copy everything inside it into the `matiks-college-league` folder
(including the hidden `.claude` folder and `.env.example`). You should now have:

```
matiks-college-league/
├── CLAUDE.md
├── SETUP.md
├── .env.example
├── .claude/commands/phase.md
├── docs/SPEC.md
├── docs/PROMPTS.md
├── supabase/migrations/0001_init.sql
├── supabase/seed.sql
└── src/ ... (from create-next-app)
```

Then:

```bash
cp .env.example .env.local
```

Fill in the three Supabase values in `.env.local` (Supabase > Project Settings > API).

## 4. Create the database

```bash
npx supabase login
npx supabase init            # answer "N" to the VS Code / Deno questions; keeps your migrations folder
npx supabase link --project-ref YOUR-PROJECT-REF
npx supabase db push         # applies supabase/migrations/0001_init.sql
```

Seed sample data: open Supabase > SQL Editor, paste the contents of `supabase/seed.sql`, Run.
Check Table Editor — you should see 8 tables, 1 league and 10 colleges.

> If `supabase init` says a config already exists or overwrites nothing, that's fine.

## 5. Make yourself an admin

Supabase > Authentication > Users > Add user (your email + password). Then in SQL Editor:

```sql
insert into public.admin_profiles (user_id, name, email, role)
select id, 'Prachi', email, 'admin' from auth.users where email = 'social@matiks.com';
```

## 6. Push to GitHub

```bash
git add .
git commit -m "Starter: spec, CLAUDE.md, schema"
git branch -M main
git remote add origin https://github.com/YOUR-ORG/matiks-college-league.git
git push -u origin main
```

`.env.local` is already git-ignored by create-next-app — double-check it doesn't get pushed.

## 7. Connect Vercel

Vercel > Add New > Project > import the repo > add all variables from `.env.local` > Deploy.
From now on every push to `main` redeploys.

## 8. Start building with Claude Code

```bash
claude
```

Inside Claude Code type:

```
/phase 1
```

Approve the plan it shows, let it build, test with `npm run dev`, commit, push.
Next session: `/phase 2`, then `/phase 3` … up to `/phase 9`.

## Rules to remember

- New database change → Claude writes a new file in `supabase/migrations/` → you run `npx supabase db push` **before** pushing code
- Never paste the service role key anywhere except `.env.local` and Vercel
- One phase per session; if something breaks, paste the exact error into Claude Code

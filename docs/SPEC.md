# Matiks College League Portal — Spec

## Goal

Replace scattered Google Forms and sheets with one source of truth for every college league season.
Students register their college from a link shared on every social channel; the Matiks team manages
all league data from a private admin panel.

**Done means**
- A student can register a college in under 3 minutes on a phone
- No duplicate colleges (one clean record per college)
- Every registration records which social channel or ambassador brought it
- Sponsor-deck numbers (colleges, participants, states, sources) come straight from the dashboard

---

## Data model

A **college** exists once and **registers** separately for each **league** (season).

| Table | Purpose | Key fields |
| --- | --- | --- |
| leagues | One row per season (e.g. Brumble 2.0) | name, slug, season, start_date, end_date, registration_deadline, registration_open, max_colleges, status |
| colleges | One clean record per college | name, short_name, normalized_name (unique), city, state, college_type, website, logo_url |
| registrations | A college's entry into one league | league_id, college_id, status, team_name, poc_email, utm_source, utm_medium, utm_campaign, utm_content, referral_code, admin_notes, reviewed_by, reviewed_at |
| contacts | POC / captain / faculty for a registration | registration_id, role, name, email, phone, year, course, matiks_username |
| participants | Players on the team | registration_id, name, email, matiks_username, year |
| ambassadors | Campus ambassadors | name, email, phone, college_id, referral_code (unique), active |
| matches | Fixtures and results | league_id, round, college_a_id, college_b_id, scheduled_at, score_a, score_b, winner_id |
| admin_profiles | Who can open /admin | user_id, name, email, role (admin / viewer) |

Rules
- unique (league_id, college_id) on registrations
- normalized_name = lowercase, letters and digits only; unique; form autocompletes existing colleges
- matiks_username required for the POC and every participant
- created_at / updated_at on every table

---

## Student panel

| Page | URL | What it does |
| --- | --- | --- |
| Landing | / | League pitch, prize pool, format, timeline, past highlights, FAQ, "Register your college" CTA |
| Register | /register | 4-step form |
| Success | /register/success | Registration ID, next steps, share buttons with pre-filled message |
| College portal | /college (was /my) | POC login; their college this season — see **League operations** |
| Colleges | /colleges | Public wall of approved colleges (name, city, logo only) |
| Fixtures | /fixtures | Public schedule and results (phase 7) |

### Registration form (4 steps)

1. **College** — type-ahead search over `colleges`; "My college isn't listed" → name, city, state, type
2. **POC details** — name, college email, phone (Indian mobile, 10 digits, WhatsApp), year, course, Matiks username
3. **Team** — team name + teammates (name, email, Matiks username). Optional; can finish later in /my
4. **Review & submit** — summary, consent checkbox (rules + data use), Turnstile captcha

On submit (server action):
- validate with zod, verify Turnstile, rate-limit by email/phone
- if college already registered for the active league → show "already registered" with POC first name only, offer to contact them
- insert college (if new) + registration (status `pending`) + POC contact + participants
- save utm_source / utm_medium / utm_campaign / utm_content / ref from the URL (persist from first landing via cookie)
- send confirmation email; redirect to /register/success?id=...
- if `registration_open` is false for the active league → show "Registrations closed"

---

## Admin panel

> Season operations (overview, college editor, access, POC portal) are specified in
> **League operations** below, which wins where the two differ.

Season picker in the top bar filters every page.

| Page | URL | What it does |
| --- | --- | --- |
| Login | /admin/login | Email+password or Google; only users in admin_profiles get in |
| Dashboard | /admin | Totals (colleges, approved, participants, states, pending); registrations per day; by utm_source; by state; top ambassadors |
| Registrations | /admin/registrations | Search, filters (status, state, source, date), sort, bulk approve/reject/waitlist, detail page with notes |
| Colleges | /admin/colleges | Master list, college page with every season played, merge duplicates |
| Participants | /admin/participants | All players by season/college; flag missing Matiks usernames |
| Ambassadors | /admin/ambassadors | Add ambassador, generate referral code + link + QR, signups per code |
| Leagues | /admin/leagues | Create season, dates, cap, open/close registration toggle |
| Matches | /admin/matches | Fixtures between approved colleges, scores, winners |
| Team | /admin/team | Add/remove admins, admin vs viewer |
| Import | /admin/import | CSV import of past seasons' colleges and participants |

Every table: "Export to Excel" and "Export CSV" of the current filtered view (admins only).

---

## Security

- RLS on every table (see `supabase/migrations/0001_init.sql`)
- Public can read: leagues, colleges (names only are public anyway), matches. Nothing else.
- Students (magic link) can read/update only registrations where `poc_email` = their login email, and that registration's contacts/participants
- Admin routes guarded by `src/proxy.ts` (Next.js 16 proxy, formerly middleware) + `is_admin()`; writes require `is_admin_writer()`
- Registration inserts go through a server action using the service role client after validation
- Turnstile captcha + rate limit on the registration action
- Privacy note + consent checkbox on the form; no phones/emails on public pages (India DPDP Act)

---

## Social tracking

Links per channel: `/register?utm_source=instagram&utm_campaign=brumble-s2`, `linkedin`, `whatsapp`, `x`,
`matiks_app`, `creator` (+ `utm_content=creatorname`). Ambassadors: `/register?ref=CODE`.

- Capture UTM + ref on first visit into a cookie (30 days), attach to registration on submit
- Open Graph image 1200x630 with league name, prize pool, deadline
- Share buttons on success page; QR codes for posters
- Vercel Analytics; `college_registered` event to product analytics

---

## League operations

Running each season after registration: stages, prize pools, contacts, winners, payouts, merch and
POC access. Modelled on the Lovable prototype "Matiks League Manager" (screens, wording, look; product name is always **Matiks College League** — never "MatiksLined" or "Matiks League Manager"), rebuilt
on this stack. **Supersedes** the Admin panel table above where they differ, and replaces `/my` with `/college`.

Everything below is **per registration** (= one college in one season). The `colleges` row stays the
clean master record; a college can have a different stage, prize pool, contacts and winners each season.

### Two status axes

| Axis | Column | Values (label) | Who changes it |
| --- | --- | --- | --- |
| Review | `registrations.status` | pending, approved, waitlisted, rejected | admins |
| Stage | `registrations.stage` | registration_phase (Registration), live (Live), ended_prize_pending (Prize pending), ended_prize_sent (Complete) | admins |

### Prize pool

- `participant_count` (int ≥ 0, admin-entered from the Matiks app) — **not** the number of `participants` rows.
- Auto tier `calc_prize_pool(count)`: 600+ → ₹10,000 · 400+ → ₹7,500 · 200+ → ₹5,000 · else ₹3,000.
- Effective prize pool = `prize_pool_override` if set, else the auto tier. UI: "Auto tier ₹X → Effective ₹Y",
  plus an "override" tag.
- Money is whole rupees (int), shown in Indian format: ₹1,00,000.

### Contacts (POCs)

- Existing `contacts` table, max **3** per registration, exactly one **primary** (★). The first contact becomes
  primary automatically; the registration form's POC is the primary.
- Fields: name, email, phone, year, course, matiks_username, tshirt_size (XS–XXL), address, pincode;
  admin-only: merch_description ("merch owed"), merch_sent, merch_sent_at (auto).
- POCs can't change merch fields or `is_primary`, and can't delete the primary contact.

### Winners

- `winners`, any number per registration: position, name, email, phone, matiks_username, upi_id,
  tshirt_size, address, pincode.
- Admin-only: prize_type (cash / cash_plus_merch / merch_only), prize_amount, merch_description,
  payment_status, paid_at (auto), payment_reference (UTR), merch_sent, merch_sent_at (auto).
- POCs add winners and edit their details; prize and payment fields are forced to defaults on insert and
  kept on update. Once a winner is **paid**, POCs can't edit (error) or delete it.
- "Mark paid" asks for the UTR.

### Access

| Who | How they get in | Lands on | Can do |
| --- | --- | --- | --- |
| Admin | `admin_profiles.role = admin` | /admin | everything |
| Viewer | `admin_profiles.role = viewer` | /admin | read everything; no writes, no exports |
| College POC | `college_access` row (invited) **or** login email = `registrations.poc_email` | /college | own registration(s): team name, contacts, winner details |
| Anyone else | — | "No access yet" page with logout | nothing |

- No sign-up form and no "claim admin". Access is invite-only from /admin/team. Supabase "Allow new users to sign up"
  is **off**, so a student has no account until an admin invites them: every approve path (row menu, bulk bar,
  editor review select, Add college) offers "Approve + invite POC", with "Approve only" as the secondary choice.
  Student-facing copy says "You'll get an email invite once your college is approved".
- Invites: look up the user with `find_user_id_by_email` (service role only); if new,
  `auth.admin.inviteUserByEmail` with redirect `/auth/callback?next=/college` (POCs) or `next=/admin`.
- Login (one page for everyone): password, magic link, forgot password → /reset-password.
- POCs never rename the college (the master record); they edit `team_name` only.

### Participants

The registration's players (`participants`: name, Matiks username, year) are shown as a **read-only list inside
the college editor** (admin and POC). There is no separate participants page.

### Duplicate colleges

`normalized_name` only catches spelling/punctuation variants; it won't match "IIT Bombay" with "Indian Institute
of Technology Bombay". Admins merge duplicates with **"Merge into…"** (Phase 11): pick the college to keep; its
registrations, matches and ambassadors move over (a season where both registered needs resolving first), then the
duplicate is deleted. Admin writers only.

### Activity log

- `activity_log` rows are written **only by database triggers**: registration status / stage /
  participant_count / prize_pool_override; winner added / payment_status / prize_amount / merch_sent / upi_id;
  contact merch_sent. Each row: registration, actor (auth.uid()), entity, field, old → new, time.
- Admins read all; POCs read their own registrations'; nobody inserts from the client.

### Database objects (migration 0003_league_ops.sql)

registrations.stage / participant_count / prize_pool_override · calc_prize_pool() · contacts merch +
is_primary + trigger (max 3, auto-primary) · winners · college_access · activity_log + triggers ·
view `registration_overview` (security_invoker) · `find_user_id_by_email()` (service_role only) ·
`is_registration_poc()` also true via college_access · admin-only field guards in triggers using the
`auth.role() = 'authenticated' and not is_admin_writer()` pattern · RLS + grants on everything; anon gets nothing.

### Screens

| URL | Screen |
| --- | --- |
| /admin | **League Overview** for the selected season: stat cards (Colleges, Prize committed, Prize paid out, Live now, Pending review); colleges table (college, review status, stage, participants, prize pool + override tag, primary POC, winners paid X/Y, POC merch X/Y, source, ⋯ menu: Manage, Copy link, Approve / Waitlist / Reject, Invite POC, Delete with typed-name confirm); search + filters in the URL; bulk approve / reject / change stage; "Add college"; Excel/CSV export (not viewers); cards on mobile; **Insights** tab with the charts |
| /admin/colleges/[registrationId] | **CollegeEditor** (mode admin): header with review status, stage, participants, override, "Auto tier ₹X → Effective ₹Y"; contact cards; winners table with expandable rows, Paid / Merch switches, "Mark paid" dialog (UTR); read-only participants list; activity timeline |
| /admin/team | **Manage Access**: invite Admin / Viewer / College POC (POC picks a college from this season); list with last sign-in; resend invite; revoke (not yourself) |
| /admin/colleges (master list) | Redirects to /admin; "Merge into…" lives on the college editor's ⋯ menu (Phase 11) |
| /college | **POC portal**: same CollegeEditor in mode poc; season switch if several; phone-first. `/my` redirects here |
| /login, /reset-password, /no-access | Auth (see Access) |

### Design

The matiks.com look on the whole site (public + admin), taken from matiks.com's own CSS variables: #1a1a1a
background (faint square grid on public pages; admin plain), lime primary `#b1fa63` with a raised darker-lime edge on
buttons, lilac `#b8a7f5` highlights, status pills (registration blue, live teal, pending amber, done grey).
Bebas Neue (all-caps) for big headings, Montserrat UI, Nunito Sans paragraphs, Space Mono numbers. Real Matiks
wordmark, app icon and mascot in `public/brand/`; the mascot appears on public pages only (hero, success, empty states).

### UX rules (better than the prototype)

- Optimistic toggles (paid, merch, stage) with an **Undo** toast.
- One sticky **"Unsaved changes · Discard · Save"** bar per editor, not a Save button on every card.
- AlertDialog for every destructive action (never `window.confirm`); typed-name confirm to delete a college.
- Skeleton loading; every empty state says what to do next.
- Ctrl/⌘+K command palette in admin (jump to a college, page or action).

### Prototype bugs we must not copy

Open sign-up + "claim admin"; POCs editing winners' prize amounts; POCs editing or deleting paid winners;
POCs renaming the college; activity log inserted from the browser (and never actually written);
invite lookup with `listUsers()` first page only; magic-link login coded but never shown; hard-coded admin
user id in a migration; the made-up name "MatiksLined".

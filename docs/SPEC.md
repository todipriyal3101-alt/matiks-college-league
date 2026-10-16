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
| My registration | /my | Magic-link login with POC email; view status; edit details and teammates until deadline |
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

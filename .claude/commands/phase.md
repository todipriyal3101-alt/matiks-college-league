---
description: Build one phase of the Matiks College League portal (usage: /phase 3)
argument-hint: <phase number>
---

Read CLAUDE.md and docs/SPEC.md. Then open docs/PROMPTS.md and find the section
"## Phase $ARGUMENTS". Follow those instructions exactly.

Before writing code, give me a short plan (files you'll create or change) and wait for my OK.
When finished: run `npm run build`, fix every error, and end with a short list of what changed
and anything I need to do myself (env vars, `npx supabase db push`, Supabase dashboard settings).

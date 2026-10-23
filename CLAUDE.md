# CLAUDE.md — Events-anth (events discovery web app)

Read this file first in every session, then the top block of `PROGRESS.md`.

## Project map
- **What it is:** events discovery site. Public pages list and show events; signed-in admins create, edit and moderate them.
- **Owner:** Bashkim (non-technical — explain in plain words, give click-by-click verification steps).
- **Stack:** plain HTML/CSS/vanilla JS (ES modules), no framework or bundler. `server.js` = local Node static server with an allow-list. Supabase (DB + auth) via `supabase-client.js` / `db.js`. Hosted on Vercel (`vercel.json` rewrites + security headers). `api/extract-event.js` = Vercel serverless function.
- **Key files:** `index.html` + `app.js` (home/list) · `event.html` + `event.js` (single event) · `admin.*`, `edit-event.*`, `inbox.*` (auth-gated via `auth-guard.js`) · `geo.js` (nearest city) · `utils-recurrence.js` · `style.css` (design tokens) · `scripts/` (build-config, sitemap, seed).
- **Plans:** `ROADMAP.md` (Now / Soon / Later). Designs: `Other/*.png`.

## Commands
- Run locally: `npm run dev` (builds `public-config.js` from `.env`, then serves). Open the printed URL.
- Sitemap: `npm run build:sitemap`.
- Seed (writes to Supabase — owner approval needed): `SUPABASE_SERVICE_ROLE_KEY=… node scripts/seed-events.js`.
- There is no test suite yet; see "Sensors".

## Rules
1. Do only the requested change. Improvement ideas go in the report and wait for approval.
2. Never commit secrets. `.env` and `public-config.js` are git-ignored; only the Supabase **publishable** key may reach the browser. The service-role key is passed at runtime only, never written to a file.
3. Ask before: deleting files or data, running the seed script, changing Supabase tables/RLS policies, deploying to production, changing `vercel.json` headers.
4. Keep `server.js` allow-list guards (path traversal, hidden files, extension checks) intact; any new served file type is added explicitly.
5. Mobile-first: check every UI change at phone width (≈375 px) and desktop, light and dark theme.

## Harness rules
1. **Contract before code.** Start every task with: goal, files expected to change, out of scope, and numbered **"Done when…"** checks that can be confirmed (a command, a page that loads with no console errors, a test).
2. **Sensors.** Until a real suite exists, the minimum check for every change is: `node --check` on each changed `.js` file, `npm run dev` starts cleanly, and the changed page(s) load in a browser with zero console errors. For logic in `utils-recurrence.js`, `geo.js` or `db.js`, add a small `node:test` test under `tests/` and run `node --test tests/`.
3. **Evidence, not claims.** The final report shows each check with its real result. Anything not run is marked **NOT VERIFIED** — never "should work".
4. **Budgets.** Max 3 fix attempts on the same failure; then stop and report what was tried.
5. **Session memory.** At the end of every session add a dated block to the top of `PROGRESS.md`: what changed, what is half-done, the exact next action.
6. **Isolation.** One branch per task. Claude merges it to `main` itself once the checks are green; no waiting for the owner to merge (owner's rule 2026-10-23).

## Report format
1. What was done (files). 2. How to verify (numbered, non-expert steps). 3. Check results (with evidence). 4. Improvement suggestions (awaiting approval).

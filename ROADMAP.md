# Roadmap

## Now
- [x] Mobile-first responsive redesign — collapsible filter cards, bottom-sheet modals, FAB cluster
- [x] Nearest-city auto-detection via `ipapi.co` with sessionStorage cache and localStorage override
- [x] Single-select city filter replacing multi-select
- [x] `#my-events-btn` moved to header; theme toggle + add button consolidated into `.fab-cluster`
- [x] `capitalizeWords` normalization on all city display surfaces
- [x] `--border-color` design token; tablet (641 px) and desktop (961 px) breakpoints
- [x] Static file server hardened with multi-layer allow-list (path traversal, hidden files, extension + name guards)
- [x] Auth-gated admin pages (Create, Edit, Inbox) backed by Supabase with ESM module pattern

## Soon
- [ ] Add `lat` and `lon` columns to the `cities` table — required for haversine nearest-city to produce matches
- [ ] Replace legacy `/upload` endpoint with Supabase Storage for public-user event-image submissions
- [ ] Update `robots.txt` sitemap URL and `CHANGE-ME-AFTER-DEPLOY` placeholder after first production deploy
- [ ] `sitemap.xml` generation script (pulls published events from Supabase, writes static file at build time)
- [ ] Persist dark-mode preference to `localStorage` so it survives page reload
- [ ] Show a spinner or skeleton cards during the geo lookup so the layout does not jump on slow connections

## Later
- [ ] Full-text event search via Supabase `fts` column instead of client-side string matching
- [ ] Recurring events — `recurrence_rule` field + expansion logic in `fetchPublishedEvents`
- [ ] PWA manifest + service worker for home-screen install and offline event cache
- [ ] Push notifications for RSVPed events (Web Push API + Supabase Edge Function scheduler)
- [ ] Social sharing — native Web Share API on mobile, fallback copy-link button on desktop
- [ ] Admin analytics view — submission funnel, RSVP counts per event, city breakdown

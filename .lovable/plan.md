
# GroundRoot — Iteration 03

**Intention from the notes (Tristan, today):** GroundRoot is *first* a personal expression platform — a tool to perform and share love and worldview with a broader audience, dedicated to one person who represents true love. Tristan is patient zero. Don't scale yet — prove the tool delivers actual intention, then let viral happen.

So Iteration 03 is **not** a feature sprint outward. It's a sharpening inward: make the tool feel like a *personal instrument* aimed at one recipient, with a single living set as the artifact and a clean way to share that artifact out. Everything else recedes.

---

## Move 1 — A "Dedication" thread woven through the app

**Goal:** make the recipient (and the why) ever-present without being maudlin.

- Extend the welcome intention model from a single string to:
  - `intention` (existing, what the set is for)
  - `dedicatedTo` (optional, who it's for — a name or a phrase like "for E.")
- On `WelcomePage`, add a small second line under the intention input: *"For… (optional)"* — a bare ghost input that, when filled, is carried along with `intention` in the search params and in the `sets` row.
- A new `dedicated_to text` column on `sets` (nullable). Migration only — no UI fanfare.
- Anywhere the intention chip is shown today (Beatmaker, Library, Assembly, Mastering header), append a quiet italic *"for {name}"* when present. This is the emotional through-line that the notes call out.

## Move 2 — One "Today's set" instead of many

**Goal:** patient-zero usage means Tristan opens the app and *continues yesterday's work*, not "create new set."

- New helper `getOrCreateTodaySet(userId, intention, dedicatedTo)` in `src/utils/today-set.ts`:
  - Looks up the most recent `sets` row for `user_id` updated in the last 24h; returns it if found, otherwise inserts a new one.
- Welcome page's seedling button now calls `getOrCreateTodaySet` instead of always inserting. The intention input pre-fills with the active set's intention if one exists.
- A subtle "Resume today's set" affordance appears on Welcome when a fresh set exists (small text link under the templates).
- `PillarTaxi` gains a 5th anchor on the right: a tiny circle that always routes to `/assembly/{todaySetId}` — the "home base" for the active artifact.

## Move 3 — Share-It-Out flow (the proof of value)

**Goal:** the notes say *"success depends on output usefulness over time"* and *"shared content proves valuable."* So shipping must feel as good as creating.

- New route `src/routes/_app.share.$setId.tsx`: a public-style preview of one set.
  - Shows the dedication line big and centered (e.g. *"For E. — a Sunday-morning brunch"*).
  - Plays the mastered render with the existing waveform.
  - Footer: small "made with GroundRoot" mark + a copy-link button + a "Download .wav" button.
- In Mastery, the existing "Render master" button is renamed to **"Render & share"** and on success:
  - Uploads the mastered WAV to Storage `masters/{setId}.wav` (public bucket).
  - Inserts/updates a `set_renders` row (`set_id`, `wav_url`, `rendered_at`).
  - Toasts a copyable share URL pointing at `/share/{setId}` and offers to open it.
- New `set_renders` table (migration): `id uuid pk`, `set_id uuid fk sets`, `wav_url text`, `rendered_at timestamptz default now()`. RLS: owner can insert/select; anonymous can select rows whose parent set has `is_public = true`.
- New `is_public boolean default false` column on `sets`. The Mastery share action flips it to true.

## Move 4 — Patient-zero feedback loop (private to Tristan)

**Goal:** the notes call out *"time will determine if shared content proves valuable."* Build a quiet log so Tristan can see whether his shares actually land.

- New route `src/routes/_app.journal.tsx` (linked from Welcome's small footer link only; not in the pillar taxi):
  - Lists every set Tristan has published, sorted newest first.
  - Per row: dedication, intention, render date, share URL with copy button, and a tiny *"how did it land?"* free-text field (saved to a new `notes text` column on `sets`).
  - Optional view counter: a public RPC `increment_set_view(setId)` called from `/share/{setId}` on mount. Display the count in the journal row.
- This page is the dashboard for the patient-zero hypothesis — useful only to him, no scaling concerns.

## Move 5 — Welcome page tone shift (Ghibli-leaning, dedication-first)

**Goal:** the landing should *feel* like a love letter's envelope, not a SaaS form. Aligns with the previously-staged Ghibli direction without committing to a full reskin.

- Subtle changes only:
  - Subtitle changes from *"Where every set takes root"* to *"A place to plant something for someone."*
  - Intention placeholder rewrites to: *"What do you want to say? (e.g. a slow morning for E.)"*
  - The dawn-sky band gets an extra layer: a single drifting paper-plane silhouette (SVG, framer-motion, slow horizontal drift) — the gentle "this is going somewhere / to someone" cue.
  - The pillar buttons get a quieter treatment: smaller, lower contrast — they recede so the intention + dedication inputs dominate.

## Out of scope (deliberately deferred)

- Auth / accounts / multi-user. Anonymous + single device is enough for patient zero.
- Analytics dashboards beyond the personal journal.
- Any "share to social" integration. The copyable URL is enough; the act of sending it manually is part of the ritual.
- Visual reskin beyond Move 5's small touches.

---

## Technical details

- **Migrations** (one batch):
  - `alter table sets add column dedicated_to text, add column is_public boolean not null default false, add column notes text;`
  - `create table set_renders (...)` with RLS as described.
  - Public select policy on `sets` and `set_renders` gated on `sets.is_public = true`.
  - Storage: ensure `masters` bucket exists and is public-read.
- **New files:**
  - `src/utils/today-set.ts` — `getOrCreateTodaySet`.
  - `src/utils/share.ts` — `renderAndPublishSet(setId)` (uploads wav, flips `is_public`, returns URL).
  - `src/routes/_app.share.$setId.tsx` — public set view (loader fetches via anon client; route is under `_app` but renders a stripped layout — no PillarTaxi when `is_public` viewed without ownership).
  - `src/routes/_app.journal.tsx` — patient-zero log.
- **Edited files:**
  - `src/components/welcome/WelcomePage.tsx` — dedication input, copy tweaks, paper-plane layer, "resume today's set" link.
  - `src/components/layout/PillarTaxi.tsx` — add a "home base" anchor pointing to today's set; keep `intention` + `dedicatedTo` in carried search params.
  - `src/utils/intention.ts` — schema gains `dedicatedTo` fallback string.
  - `src/routes/_app.mastering.tsx` — rename action, wire `renderAndPublishSet`, success toast with share URL.
  - All four pillar route headers — render *"for {name}"* tag when present.
- **No changes** to `src/integrations/supabase/client.ts`, `types.ts`, `.env`, or `routeTree.gen.ts`.
- **Auth:** continue with anonymous sign-in only; do not add login/signup forms in this iteration. Per platform rules this is acceptable because the public `/share/{setId}` flow uses RLS gated on `is_public`, and journal access is gated on `auth.uid() = sets.user_id`.

---

## Why this plan respects the intention

- It refuses to chase a wider customer base before the tool earns it.
- It puts the recipient and the act of sharing at the structural center of the app — exactly the *"first-person artistic sharing mechanism"* framing.
- It gives Tristan one durable artifact per day (today's set) instead of fragmenting attention across new sessions.
- It builds the smallest possible feedback loop (the journal) so "time will tell if it's valuable" can actually be measured by him, privately.

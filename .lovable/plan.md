## Goals

1. Keep the welcome coach conversation alive so the user can return to `/welcome` and either re-read it, ask "where did we leave off", or jump back to where they were.
2. Stop the floating Pillar Taxi + Home button from overlapping pillar page titles by introducing a real top ribbon that reserves space.
3. Remove the floating Engine Debug HUD from the Assembly pane.

---

## 1. Persistent intention conversation on `/welcome`

### Storage
Add a new table `coach_conversations` (one row per `set_id`, owned by user) with:
- `id`, `user_id`, `set_id` (fk to `sets`, unique), `messages` jsonb (array of `{role, content, chips?, isFinal?, pillar?, section?}`), `last_pillar` text, `last_section` text, `created_at`, `updated_at`.
- RLS: users can select/insert/update/delete their own rows via `user_id = auth.uid()`.
- Trigger to bump `updated_at`.

(Storing on a dedicated table keeps the `sets` row clean and lets the conversation grow over multiple visits.)

### Welcome page changes (`src/components/welcome/WelcomePage.tsx`)
- On mount, after resolving today's set, load the matching `coach_conversations` row. If present:
  - Restore `messages`, `intention`, `dedicatedTo`.
  - Show a soft "Welcome back — we left off here" banner above the thread, with two buttons:
    - **Continue where we left off** → navigates to `last_pillar` + `last_section` (using the existing `persistAndGo` flow).
    - **Keep talking** → focuses the reply input so the user can ask a new question (e.g. "where did we leave off").
- Persist after every turn:
  - When the user sends a message, when the coach replies, and when the coach routes — upsert `messages`, `last_pillar`, `last_section`.
- Add a small **"Start a new intention"** link that clears the conversation (deletes the row, resets state) for users who want a fresh canvas.

### Coach edge function (`supabase/functions/welcome-coach/index.ts`)
- Add a new branch handling **resumed conversations**: when the latest message is a *user* message arriving after a previous `route_to_pillar` (so `isFinal` was true), the system prompt is extended with: "The user has come back. Their last destination was `<pillar>/<section>`. Either gently remind them where they were and offer to send them back, or route them somewhere new if they're asking for something different."
- Bump `MAX_TURNS` only for resumed sessions (e.g. allow 3 extra turns per resume) so a returning user isn't immediately forced into a route.
- The model can still call `route_to_pillar`; on a "where did we leave off" style question, the prompt steers it to call `route_to_pillar` with the previous `last_pillar`/`last_section` so the same focus highlight kicks in on arrival.

### Cross-pillar entry point
- Add a tiny **"Back to today's intention"** link inside the existing Home button menu: when the user is on a pillar page and a conversation exists, the home button gets a subtle dot indicator. Clicking still goes to `/welcome`, where the resumed thread now waits for them.

---

## 2. Top ribbon (no more overlap with page titles)

### New layout primitive
- Create `src/components/layout/TopRibbon.tsx`: a real, in-flow `<div>` (NOT `fixed`) that hosts the Pillar Taxi (centered) and the Home button (right). It sits at the top of the main column with a fixed height (`h-12`) and a subtle backdrop blur.
- Update `src/components/layout/AppShell.tsx`:
  - On non-welcome routes, render `<TopRibbon />` above `<main>` instead of mounting `PillarTaxi` and `HomeButton` as `fixed` overlays.
  - Keep the welcome route's existing absolute logo/theme-toggle header unchanged.

### Component changes
- `PillarTaxi.tsx`: remove the outer `pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center px-4` wrapper; export only the pill itself so `TopRibbon` can place it.
- `HomeButton.tsx`: remove the `fixed right-4 top-3 z-50` wrapper; export the button so `TopRibbon` can place it on the right.
- Leave the welcome page's logo (top-left, absolute) untouched — `TopRibbon` only mounts on pillar routes.

### Result
The ribbon takes its own row, so pillar headers (Assembly's "Untitled set" / track count chip, Library's titles, Beatmaker, Mastering) sit cleanly below it with no overlap on a 714-wide viewport.

---

## 3. Remove the engine debug HUD

In `src/routes/_app.assembly.tsx`:
- Delete the `debugOpen` state, the `<DebugHUD ... />` block, the toggle button, and the entire `DebugHUD` component + `Row` helper.
- Remove the now-unused `Bug` and `X` lucide imports if nothing else uses them.
- Remove the `console.log("[engine] …")` lines (keep `console.error` for real failures).

This is a UI-only cleanup; the audio engine itself stays intact.

---

## Files

**New**
- `src/components/layout/TopRibbon.tsx`
- Migration: `coach_conversations` table + RLS + trigger.

**Edited**
- `src/components/welcome/WelcomePage.tsx` — load/save conversation, "welcome back" banner, continue/keep-talking actions, restart link.
- `supabase/functions/welcome-coach/index.ts` — resumed-conversation prompt branch, extra turns on resume.
- `src/components/layout/AppShell.tsx` — mount `TopRibbon` instead of fixed overlays.
- `src/components/layout/PillarTaxi.tsx` — drop fixed wrapper.
- `src/components/layout/HomeButton.tsx` — drop fixed wrapper; optional unread-dot when a conversation exists.
- `src/routes/_app.assembly.tsx` — remove DebugHUD + related state/imports/logs.

---

## Open question

When the user clicks **"Start a new intention"** on `/welcome`, should we:
- (a) Archive the old conversation and create a brand-new `today's set`, or
- (b) Keep the same `set` and just clear the chat thread (intention/dedication get rewritten on the same set)?

Default: **(b)** — one set per day stays intact; only the conversation resets. Confirm or override after approval.

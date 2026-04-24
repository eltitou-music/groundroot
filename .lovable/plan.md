
# GroundRoot — Iteration 02 (from Test Notes 01)

Plan addresses Tristan's six feedback themes: shell cleanup, Beatmaker default tracks, broken back-buttons, hand-off flow Beatmaker↔Library↔Assembly, Mastery rebuild, and a playful top navigator. Studio-Ghibli landing direction is staged as a follow-up move.

---

## Move 1 — App shell cleanup (everywhere except Welcome)

**Goal:** "Color palette + logo only on the first page."

- Edit `src/components/layout/AppShell.tsx`:
  - Read current pathname via `useLocation()`.
  - Render the GroundRoot logo + wordmark **only** when path is `/welcome` or `/`.
  - Render `ThemeToggle` only on `/welcome`.
  - On every other route the header becomes a thin transparent strip that just hosts the new top navigator (Move 5) — no logo, no palette.
- Remove the `pt-20` worth of breathing-room conflicts on Beatmaker / Library / Mastering / Assembly that currently collide with the floating logo.

## Move 2 — Fix navigation interference

**Goal:** "Buttons redirect back to first page instead of functioning properly."

Root cause from test: several in-page actions wrap content in a `<Link to="/welcome">` parent or share a click target. We will:

- Audit `_app.beatmaker.tsx`, `_app.library.tsx`, `_app.mastering.tsx` for any element nested inside a Link/anchor where the inner button has its own `onClick`. Replace nested `<Link>`s with explicit `useNavigate()` calls on the back chevron only.
- Ensure transport buttons (Play, Reseed, Quantize, Style chips) call `e.stopPropagation()` where they currently bubble into a parent navigation handler.

## Move 3 — Beatmaker default to 5 voices + hand-off

**Goal:** "Only 4 tracks available, requested 5" + "direct export from beat maker to assembly."

- `src/routes/_app.beatmaker.tsx`:
  - Default `visibleVoices` state to **5** (Heart, Clap, Whisper, Spark, Bloom). Pulse remains togglable as a 6th.
  - Add a "+ voice" / "− voice" pair in the voice rail so the count is user-driven (3–6).
- Add a **"Send to Assembly"** primary button in the transport bar:
  - Renders the current 32-step pattern to a WAV blob (offline `OfflineAudioContext`), uploads it to Supabase Storage `sketches/`, inserts a row in `tracks` with `source = 'beatmaker'`, and navigates to `/assembly/$setId`.
  - If no set exists yet, create one on the fly using the carried `intention` query param (reuses `handleCommitToSet`).
- Add a secondary **"Save sketch"** that just stores the pattern JSON without leaving.

## Move 4 — Library quick-import to Assembly + source-bottom-left

**Goal:** "Library should have quick import button to assembly" (and finalize last iter's "source at bottom left").

- `src/routes/_app.library.tsx` / `src/utils/library.functions.ts`:
  - Each suggestion card grows an **"→ Assembly"** icon button (top-right of card) that inserts the track into the current set (or creates one) and navigates.
  - Confirm the source attribution chip (FMA / archive.org / OpenMusicArchive) is rendered **bottom-left** of each card with a small globe icon and a hover tooltip explaining why this source was chosen ("free to share & remix" etc.) — this directly serves the "trust" goal from the previous iteration.

## Move 5 — Top "taxi" navigator between pillars

**Goal:** "Top navigation bar with scroll arrows between all pages" / "playful, app-radio / taxi-like."

- New component `src/components/layout/PillarTaxi.tsx`:
  - Fixed thin bar at top-center on every non-welcome route.
  - Shows the current pillar name flanked by `‹` and `›` arrows that cycle through the ordered loop: **Beatmaker → Library → Assembly → Mastery → Beatmaker**.
  - Each arrow press triggers a small horizontal slide animation (framer-motion) and `navigate()` with the current `intention` preserved as search param.
  - Optional: a tiny radio-dial style row of dots underneath showing which pillar you're on (4 dots).
- Mount it inside `AppShell.tsx` (only when not on `/welcome`).

## Move 6 — Mastery rebuild around a full waveform

**Goal:** "Mastery tool completely off-target. Should display full track preview with complete sound wave visualization. Effects at top."

Restructure `_app.mastering.tsx` from "controls left, meter right" to a vertical stack:

```text
┌───────────────────────────────────────────────────┐
│  EFFECTS RAIL (chips: Loudness, EQ, Width, Glue)  │ ← top
├───────────────────────────────────────────────────┤
│                                                   │
│   FULL-WIDTH WAVEFORM (entire set, scrubbable)    │ ← center, dominant
│   playhead • zoom • loop region                   │
│                                                   │
├───────────────────────────────────────────────────┤
│  Translate-to presets · Render master button      │ ← bottom
└───────────────────────────────────────────────────┘
```

- Add `wavesurfer.js` (already Worker-friendly) to render the waveform.
- Source: load the latest assembled set's stitched preview from Supabase Storage; fall back to a placeholder sine sweep when nothing is assembled yet so the page is never empty.
- Effects chips at top open a popover with the existing sliders (Loudness, 3-band EQ, Width, Glue) — keeps current logic but moves it out of the main visual hierarchy.
- Output meter is folded into a thin LUFS strip directly under the waveform.

## Move 7 — Memory + landing direction (staged)

- Save `mem://design/landing-direction` recording the Studio-Ghibli / earthy vibe target so future passes don't re-propose the current style.
- This iteration does **not** redesign the landing page (out of scope for one move) — it stays as-is until we run a focused "Welcome reskin" pass.

---

## Technical notes

**Files to edit**
- `src/components/layout/AppShell.tsx` — conditional logo, mount taxi
- `src/routes/_app.beatmaker.tsx` — 5 default voices, +/− voice control, hand-off buttons, offline render
- `src/routes/_app.library.tsx` + `src/utils/library.functions.ts` — per-card Assembly button, confirm source chip placement
- `src/routes/_app.mastering.tsx` — full restructure around waveform
- `src/routes/__root.tsx` — no change required

**Files to create**
- `src/components/layout/PillarTaxi.tsx`
- `src/utils/beatmaker-export.ts` — `OfflineAudioContext` → WAV blob helper
- `mem://design/landing-direction` + index update

**New dependency**
- `wavesurfer.js` (added via `bun add` before import)

**Backend**
- Reuse existing `sets` and `tracks` tables. Add a Supabase Storage bucket `sketches` (public read) if it doesn't already exist, via migration.

**Out of scope for this iteration** (call out so it isn't expected)
- Studio-Ghibli landing redesign
- Real DSP on Mastery (still preview-grade)
- Multi-user collaboration on a set

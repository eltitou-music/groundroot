## Goal

Two integrated changes to the welcome → pillar journey:

1. **Replace every "Back" arrow with a Home button** (top-right of the screen, mirroring the logo top-left). GroundRoot never goes back — only home.
2. **Turn the welcome flow into a real coaching conversation** (Claude-style, 3–5 back-and-forth turns with quick-reply chips), then route the user to the right pillar AND scroll/highlight the specific section they should use.

---

## Part 1 — Home button (replaces back arrows)

### What changes

- **Add `HomeButton` component** (`src/components/layout/HomeButton.tsx`)
  - Fixed top-right, z-40, mirrors the logo's top-left placement on `/welcome`.
  - `Home` icon (lucide) inside a small rounded pill (matches `PillarTaxi` styling: `border border-border/60 bg-card/70 backdrop-blur-md`).
  - Always navigates to `/welcome` (never `history.back()`).
  - `aria-label="Home"`, tooltip "Home".

- **Mount it in `AppShell`** alongside `PillarTaxi` (so it appears on every non-welcome route). The welcome route already shows the `ThemeToggle` top-right — keep that. Home button only appears when `PillarTaxi` is shown.

- **Remove the "Back" buttons** from:
  - `src/routes/_app.beatmaker.tsx` (lines 328–335)
  - `src/routes/_app.library.tsx`
  - `src/routes/_app.mastering.tsx`
  - `src/routes/_app.about.tsx`
  - `src/routes/_app.journal.tsx`
  - `src/routes/_app.assembly.$setId.tsx`
  - (Leave the in-component `ChevronLeft` in `SpotifyPanel` — that's a panel-internal back, not page nav.)

### Layout

```text
[ logo  GroundRoot ]                              [ Home ]   ← welcome
[                  PillarTaxi (centered)          Home   ]   ← pillars
```

---

## Part 2 — Multi-turn coaching conversation

### Conversation shape

The current welcome only does one reflect → one reply → route. We expand it to a **chat thread** of up to 5 assistant turns that progressively narrows the user's intention, then routes with a guided handoff.

```text
Turn 1  AI:  warm affirmation + first clarifying question
        UI:  3–4 quick-reply chips + free text box
Turn 2  AI:  acknowledges, asks a sharper question (mood / energy / time of day…)
        UI:  3–4 chips + free text
Turn 3  AI:  asks where in the journey they are (start from scratch? have material?)
        UI:  chips + free text
Turn 4  AI:  optional — narrows pillar (e.g. "drums first, or melody first?")
Turn 5  AI:  "Here's where I'm taking you" — names the pillar + the specific
             section/tool to use, then routes.
```

The AI decides each turn whether to **ask another question** or **commit to a route**. Hard cap at 5 turns; if it hasn't routed by turn 5, it must route.

### Edge function changes (`supabase/functions/welcome-coach/index.ts`)

Replace the two-action design with **one action: `converse`**, plus keep `reflect` as a thin wrapper for backwards compatibility (or remove — it's only called from one place).

New request body:
```json
{
  "intention": "...",
  "dedicatedTo": "...",
  "history": [
    { "role": "assistant", "content": "..." },
    { "role": "user", "content": "..." }
  ],
  "turn": 2
}
```

The AI is given **two tools** and must call exactly one each turn:

- `ask_followup(question, chips[])` — chips are 3–4 short labels (≤ 4 words each) that the user can tap as a quick reply. Free text always remains available.
- `route_to_pillar(pillar, section, why)` — finalises. `section` is one of a known enum per pillar (see "Section anchors" below).

System prompt updates:
- "You are a warm, Ghibli-quiet coach. Ask up to 4 short, focused follow-ups before routing. Each question narrows ONE dimension: mood, energy arc, time of day, what they already have, where they want to start. Never repeat a dimension you've already asked about. After turn 5 you MUST route."
- Tone rules unchanged (warm, no buzzwords, ≤ 60 words).
- When `turn >= 5`, the system message forces `route_to_pillar`.

Response shape:
```json
// follow-up turn
{ "kind": "followup", "message": "…", "chips": ["Sunset", "After dark", "Morning"] }
// final turn
{ "kind": "route", "message": "Let's start in the Library and find your anchor track.",
  "pillar": "library", "section": "search", "why": "…" }
```

### Section anchors per pillar (handoff targets)

Each pillar exposes a small set of named sections the AI can point to. We add `id` attributes + a one-time highlight effect.

| Pillar     | Sections (enum)                                          |
|------------|----------------------------------------------------------|
| beatmaker  | `pads`, `tempo`, `pattern`, `send-to-set`               |
| library    | `search`, `spotify`, `editorial`, `add-to-set`          |
| assembly   | `intention-pin`, `sources`, `transitions`, `copilot`    |
| mastering  | `loudness`, `eq`, `render`, `share`                     |

Implementation:
- In each pillar page, add `id="gr-section-{name}"` on the existing primary panels (no UI change, just anchor IDs).
- Pillar routes already accept `?intention=` & `?dedicatedTo=` via `intentionSearchSchema`. Extend it with optional `?focus={section}` (zod fallback to "").
- Add a small hook `useFocusHandoff()` that on mount reads `?focus=`, scrolls the matching `#gr-section-...` element into view (smooth, block: "center"), and applies a temporary glow class (`ring-2 ring-warm-link/60 animate-pulse` for ~3s, then removed). Toast a quiet line: "Start here — \<section label\>."

### WelcomePage changes (`src/components/welcome/WelcomePage.tsx`)

- Replace `stage` machine with a `messages: Message[]` thread + `pending: boolean`.
- Render messages as a chat (assistant bubbles + user bubbles), keeping the existing Ghibli card styling for the assistant.
- After each assistant message: render its `chips` as tap-to-send buttons + the free-text reply box.
- Each user reply calls `welcome-coach` with the full `history` + `turn` count.
- When the response is `kind: "route"`, show the final assistant line briefly (~900ms), persist the set (existing `getOrCreateTodaySet` flow), then `navigate({ to, search: { intention, dedicatedTo, focus: section } })`.
- For `assembly` route, navigate to `/assembly/$setId` with `search: { focus }`.
- Keep the four pillar cards visible at the bottom as **"skip the chat — take me there"** shortcuts (current behaviour).

### Conversation safety

- Hard cap: 5 assistant turns. If the AI tries a 6th `ask_followup`, the client ignores chips and forces a route call with `turn=99` so the system prompt commits.
- Server-side validation: clamp `history.length` to last 12 messages, intention 500 chars, each user reply 500 chars.

---

## Files touched

**New**
- `src/components/layout/HomeButton.tsx`
- `src/hooks/useFocusHandoff.ts`

**Edited**
- `src/components/layout/AppShell.tsx` — mount `HomeButton` next to `PillarTaxi`
- `src/components/welcome/WelcomePage.tsx` — multi-turn chat thread
- `supabase/functions/welcome-coach/index.ts` — new `converse` action, two-tool design
- `src/utils/intention.ts` — add `focus` search param
- `src/routes/_app.beatmaker.tsx` — remove Back btn, add section IDs, call `useFocusHandoff`
- `src/routes/_app.library.tsx` — same
- `src/routes/_app.assembly.tsx` — same (section IDs around `IntentionPin`, `SourcesPanel`, `TransitionMap`, `CoPilotPanel`)
- `src/routes/_app.assembly.$setId.tsx` — remove Back btn, call `useFocusHandoff`
- `src/routes/_app.mastering.tsx` — remove Back btn, add section IDs, call hook
- `src/routes/_app.about.tsx`, `src/routes/_app.journal.tsx` — remove Back btn

---

## Open question (one only)

**Should the conversation thread persist across page reloads of `/welcome`** (saved in localStorage so a refresh keeps the chat going), or always start fresh on each visit? My default is **always fresh** — the welcome screen is meant to be a calm new beginning each time. Tell me if you'd rather persist.


## Redesign the intro page

Make `/` a calm, atmospheric landing — big "GroundRoot" wordmark, a short purpose tagline, one intention input, and a quiet row of destinations. Tone down the gradient so color radiates from a warm yellow center outward to orange/red, and give the black canvas a subtle carbon texture for depth.

### What you'll see

```text
┌───────────────────────────────────────────────────────┐
│                                            [☾  ☀]    │  ← theme toggle
│                                                       │
│                                                       │
│                    GroundRoot                         │  ← huge wordmark, radial yellow→orange→red
│                                                       │
│        a tool to transcend through music              │  ← soft gray tagline
│                                                       │
│                                                       │
│      ┌──────────────────────────────────────┐         │
│      │  What's today's intention?           │         │  ← single calm input, Enter to begin
│      └──────────────────────────────────────┘         │
│                                                       │
│                                                       │
│   Assembly · Beatmaker · Library · Mastering · About  │  ← warm-yellow text links, dot separators
│                                                       │
└───────────────────────────────────────────────────────┘
```

### Changes

**1. `src/routes/_app.index.tsx` — full rewrite**
- Drop Set name / Occasion / Vision form. Keep only one input: the intention.
- Layout: vertically centered, generous whitespace, max-w ~720px.
- Big `GroundRoot` wordmark (display font, ~clamp(64px, 11vw, 140px), tight tracking) using the new radial gradient utility.
- Tagline below in muted gray: "a tool to transcend through music — sequence, shape, master".
- Single intention input (ghost style, no visible border, soft underline, large placeholder "What's today's intention?"). Enter or arrow button creates a set and routes to `/assembly/$setId` (preserving the existing anonymous-session + insert flow, with intention saved).
- Below the input: a single horizontal line of destination links separated by `·` dots:
  - `Assembly` → `/assembly` (active)
  - `Beatmaker`, `Library`, `Mastering`, `About` → render as disabled spans with `title="coming soon"` (kept warm-yellow but slightly dimmer + cursor-not-allowed)
  - Color: warm yellow (`oklch(0.86 0.16 90)` in dark; existing primary in light), small uppercase tracking, subtle hover that lifts opacity.

**2. `src/styles.css` — refine the palette + add texture**
- Replace flat `--background` (dark) with a layered carbon look:
  - Base color stays near-black but slightly warmer: `oklch(0.07 0.005 60)`.
  - Add a body `background-image` stack on `.dark body`: a faint radial highlight (warm) + a tiny SVG noise data-URI for grain. Light theme keeps a clean cool gradient.
- Replace the linear `--gradient-brand` with a **radial** gradient centered on the wordmark — yellow core, orange mid, red edge — and add a new utility `.text-gradient-brand-radial` that uses `background-size` tied to the element so the radial reads correctly on text.
  - Dark: `radial-gradient(ellipse at center, oklch(0.92 0.19 95) 0%, oklch(0.78 0.21 60) 45%, oklch(0.55 0.25 25) 100%)`
  - Light: `radial-gradient(ellipse at center, oklch(0.78 0.16 220) 0%, oklch(0.7 0.18 160) 50%, oklch(0.55 0.24 300) 100%)`
- Soften the existing `text-gradient-brand-strong` so other places in the app (sidebar wordmark, headings) feel less "Word Art" — lower chroma (~0.16) and slightly darker stops.
- Add `--color-warm-link: oklch(0.86 0.16 90)` (dark) / `oklch(0.55 0.18 70)` (light) and a `.text-warm-link` utility for the destination row.

**3. `src/components/layout/AppShell.tsx`**
- Sidebar wordmark uses the softened `text-gradient-brand-strong` (no change needed — it inherits).
- No structural change otherwise.

### Behavior details

- Pressing Enter in the intention input or clicking the small arrow → same anonymous-session + `sets` insert flow that exists today, then `navigate({ to: "/assembly/$setId" })`. Empty intention is allowed (set is created with `title: "Untitled set"`).
- The destination links: `Assembly` is a real `<Link>`; the four "coming soon" ones are spans (no nav, dimmer, tooltip). This matches the sidebar's existing `comingSoon` treatment.
- Theme toggle continues to live top-right via `AppShell`.

### Out of scope

- No changes to Assembly, Spotify panel, auth flow, or routes other than `/`.
- No new routes for Beatmaker/Library/Mastering/About yet — they remain placeholders surfaced as text links.


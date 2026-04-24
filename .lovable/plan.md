## GroundRoot v0.8 — full reimagine

### Honest preface on the PDF

The uploaded `GroundRoot_v0.7.pdf` (51 pages) contains the captured source of the **Claude.ai host page**, not the GroundRoot artifact itself: pages 1-13 are Claude's CSS/JS bundle URLs, pages 14-51 are Claude's French i18n dictionary (Marketplace, Cowork, GitHub app, billing strings). The artifact runs in a sandboxed iframe that print-to-PDF cannot capture, so there is no v0.7 design language to merge from — only the **name** "GroundRoot" is recoverable. This plan therefore reimagines v0.8 as a fresh release rather than a literal merge.

### Concept: "GroundRoot" — earthy, grounded, alive

A musician's intention starts as a seed in fertile ground; the app grows it into a finished set. The visual language replaces Pio-Near's seaside sunset with a **forest-floor / underground-roots** aesthetic — warm earth tones, root-structure motifs, and quiet plant life. Same Studio-Ghibli watercolor technique (pure CSS + SVG, no AI art), reapplied to the new palette.

**Palette (replaces Pio-Near's coral/indigo):**
- `#2A1F17` deep loam (background, dark mode base)
- `#3D2E20` warm bark (surfaces)
- `#8B5A2B` clay (primary accent)
- `#D4A574` honey (secondary, hover)
- `#6B8E4E` moss green (links, success)
- `#E8DCC4` parchment (light surfaces)
- `#C44536` clay-red (destructive / set-fire moments)

**Tagline:** "Where every set takes root."

### 1. Brand swap (Pio-Near → GroundRoot)

- Wordmark "GroundRoot" everywhere (single word, capital R).
- Asset: generate `src/assets/groundroot-logo.png` — a stylized seedling whose root system spreads downward into a vinyl-record groove pattern. Square ~512×512, transparent background.
- localStorage key: `groundroot-theme` (with one-time migration from `pio-near-theme` and earlier `osmose-theme`).
- CSS animation rename: `pio-breath` → `root-breath` (same 6s cycle).
- Meta tags in `__root.tsx` and `_app.welcome.tsx`: title `GroundRoot — Where every set takes root`.
- About page copy refreshed.

### 2. Welcome page redesign (`src/components/welcome/WelcomePage.tsx`)

Replace the sunset-over-sea hero with a **soil cross-section** scene:

```text
┌───────────────────────────────────────────────────────────────┐
│ [GroundRoot logo · top-left]                  [theme toggle] │
│                                                               │
│   ╭─ DAWN SKY (slim band, ~18vh) ──────────────────────────╮ │
│   │   pale honey → parchment, single soft sun              │ │
│   ╰────────────────────────────────────────────────────────╯ │
│   ~~~~~~ horizon line of grass blades (SVG) ~~~~~~~~~~~~~~~  │
│                                                               │
│              ╔═════════════════════════════╗                 │
│              ║         GroundRoot          ║   (display)     │
│              ║ Where every set takes root  ║   (subtitle)    │
│              ╚═════════════════════════════╝                 │
│                                                               │
│        ┌───────────────────────────────────────────┐         │
│        │  Today's intention                        │         │
│        │  [ I want to make a mixtape for…    →]   │         │
│        └───────────────────────────────────────────┘         │
│                                                               │
│      🌅 Sunset brunch  🌑 Techno night  🎚️ House warmup      │
│      🌫️ Afters  📚 Focus session  🚗 Road trip               │
│                                                               │
│      Beatmaker · Library · Assembly · Mastery · ( ? )        │
│                                                               │
│   ░░░░░░░░░░░░ SOIL LAYER (CSS gradient) ░░░░░░░░░░░░░░░░░  │
│   ╲╱╲ root system (SVG, branching paths, slow grow) ╱╲╱╲    │
└───────────────────────────────────────────────────────────────┘
```

**New visual elements:**
- **Dawn sky band** at top (replaces sunset hero): pale honey → parchment gradient, single small sun, ~18vh (smaller than v0.7's 38vh).
- **Grass horizon** (SVG): row of irregular blade silhouettes in moss green, hand-drawn stroke style.
- **Soil layer** at bottom (replaces plants strip): warm bark-to-loam gradient occupying bottom ~30vh.
- **Root system** (SVG, ~200 lines): branching paths radiating from below the wordmark down into the soil. Uses `stroke-dasharray` + animation for a slow "growing" effect on first load (respects `prefers-reduced-motion`).
- **Three small plant sprouts** poke through the grass line at staggered positions, swaying gently (reuses existing `plantSway` keyframes, renamed `rootSway`).
- Keeps existing intention-template chips, intention input, and destinations row — only restyled to new palette.

### 3. Pillar pages redesign

Each of the four pillar pages gets a small visual identity tied to GroundRoot's earthy theme, while preserving the functional first drafts already shipped.

**Beatmaker (`_app.beatmaker.tsx`)** — "Plant the seed"
- Reframe sequencer cells as **soil plots**: rounded squares with warm bark fill, active steps glow honey/clay.
- Voices renamed visually: Kick → Heart, Snare → Clap, Hat → Whisper, Perc → Spark (functional names, keeps Web Audio synthesis).
- Transport bar gets a "soil moisture" visualizer: BPM controls a subtle pulsing root pattern in the background.

**Library (`_app.library.tsx`)** — "The seed bank"
- Track cards become **seed-packet cards**: parchment background, hand-drawn label corner, mood badges as botanical tags.
- Mood filters renamed to growth metaphors: warm → "germinating", dark → "deep roots", hypnotic → "spiraling vine", etc. (label-only; underlying mock data unchanged).
- Search bar gets a small leaf icon.

**Assembly (`_app.assembly.tsx` + `_app.assembly.$setId.tsx`)** — "The garden"
- Top bar gets a small breadcrumb root motif.
- The existing multi-track workspace inherits the new theme tokens; no structural change to logic.
- Empty-state illustration: a single seedling with an empty plot beside it, "Add your first track to start growing your set."

**Mastery (`_app.mastering.tsx`)** — "Harvest"
- Visual meter restyled as a horizontal **growth ring** (concentric arcs) instead of bars.
- "Translate to" presets become **soil profiles**: Club → "Festival ground", DSP → "Garden bed", Vinyl → "Forest floor" (label-only).
- LUFS/EQ controls keep their function; sliders get warm clay-colored thumbs.

### 4. AppShell + theme system

- `AppShell.tsx`: new logo, wordmark "GroundRoot", header gets a 1px moss-green underline strip.
- `ThemeProvider.tsx`: storage key migration chain `osmose-theme` → `pio-near-theme` → `groundroot-theme`.
- `src/styles.css`:
  - Add new CSS custom properties for the GroundRoot palette under `:root` and `.dark` (the existing variable names like `--background`, `--foreground`, `--warm-link` get remapped to the new earth palette — no Tailwind class changes needed in any consumer).
  - Rename keyframes `pio-breath` → `root-breath` and `plantSway` → `rootSway`.
  - Add a new `rootGrow` keyframe (stroke-dasharray animation) for the welcome-page root system.
- `__root.tsx`: meta updates only (title, description, og tags, favicon).

### 5. New files / asset

- `src/assets/groundroot-logo.png` — generated.
- No new routes; `/welcome` stays the canonical landing.
- `src/components/welcome/RootSystem.tsx` — extracted SVG component (~120 lines) for the animated root illustration, kept separate from `WelcomePage.tsx` to keep the latter readable.

### 6. Out of scope

- Buying the `groundroot.io` domain (user action).
- Rewriting Web Audio synthesis, Spotify integration, or Supabase schema — purely visual + brand changes plus the small label renames listed above.
- Real botanical illustrations or photography — everything stays pure CSS/SVG to preserve the painterly Ghibli technique.

### Files touched

| File | Change |
|---|---|
| `src/assets/groundroot-logo.png` | new (generated) |
| `src/components/welcome/WelcomePage.tsx` | full rewrite of hero + plants strip + copy |
| `src/components/welcome/RootSystem.tsx` | new SVG component |
| `src/components/layout/AppShell.tsx` | logo + wordmark swap |
| `src/components/theme/ThemeProvider.tsx` | storage key + migration |
| `src/styles.css` | palette remap, keyframe renames, `rootGrow` keyframe |
| `src/routes/__root.tsx` | meta + favicon |
| `src/routes/_app.welcome.tsx` | meta block |
| `src/routes/_app.about.tsx` | copy |
| `src/routes/_app.beatmaker.tsx` | restyle + voice label rename |
| `src/routes/_app.library.tsx` | restyle + mood label rename |
| `src/routes/_app.assembly.tsx` | top-bar restyle + empty state |
| `src/routes/_app.mastering.tsx` | meter + preset label restyle |

Old `pio-near-logo.png` is left in place untouched (no orphan deletions); imports just stop referencing it.

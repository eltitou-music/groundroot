

## Apply the GroundRoot logo + palette, build a real Assembly workspace

Two things: (1) bring the actual GroundRoot logo and its earthy palette (forest green, mustard yellow, terracotta orange, off-white) into the app, and (2) make `/assembly` a real Audacity-style multi-track workspace — distinct from the intro page — instead of a duplicate landing.

### 1. Logo + palette

**Add the logo as an asset**
- Save the uploaded image to `src/assets/groundroot-logo.png`.
- Replace the "G in a gradient square" mark in `AppShell.tsx` sidebar with `<img src={logo}>` at 32px. Keep the wordmark text next to it.
- Use the same logo in the intro `_app.index.tsx` above the wordmark (small, ~120px), so the page "lands" with the brand.
- Add it as the favicon/og-image (small change to `__root.tsx` head meta).

**Retune the palette to match the logo**
- Update `src/styles.css` so both themes pull from the logo's earthy palette instead of the current saturated yellow→red:
  - Mustard yellow `oklch(0.84 0.16 90)`
  - Terracotta orange `oklch(0.68 0.17 50)`
  - Forest green `oklch(0.42 0.08 145)` (deep, like the droplet outline)
  - Cream/off-white `oklch(0.96 0.02 85)`
- Dark theme: deep warm-charcoal background (slightly brown-tinted, like soil), forest-green accents for borders/structure, mustard→orange radial for the brand gradient, cream text. Removes the "fire / red" feel; lands on "earth + sun".
- Light theme: cream background, forest-green text, mustard→orange brand gradient. Keeps the optional "blue→green→violet" alt out — the logo defines the brand now.
- `--warm-link` becomes mustard in dark, terracotta in light.
- Soften `text-gradient-brand-radial` so it reads as a sun (yellow core → orange edge), no red.

### 2. A real Assembly workspace at `/assembly`

Today, the sidebar's "Assembly" entry points to `/` and the only real workspace lives at `/assembly/$setId` (a 3-column SourcesPanel / TransitionMap / CoPilot layout). We'll build a proper Audacity-like editor as the Assembly home, while keeping the existing set-based flow available.

**New route: `src/routes/_app.assembly.tsx`** — the Assembly workspace. Layout:

```text
┌─────────────────────────────────────────────────────────────────────────┐
│  Transport: ⏮ ▶ ⏸ ⏹  ⏺   00:00:42 / 03:14    Zoom −/+   Snap  BPM 124  │  ← top bar
├─────────────────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌─────────────────────────────────────────────────────┐    │
│ │ Track 1  │ │ ░░▓▓▓▒▒░░  ░▒▓██▓▒░  ░░▓▓▒░  (waveform)            │    │
│ │ Vocals   │ │                                                     │    │
│ │ M S 🎚   │ │                                                     │    │
│ ├──────────┤ ├─────────────────────────────────────────────────────┤    │
│ │ Track 2  │ │ ▒▒▓██▓▒░  ░░▓▓▓▒░░  ░▒▓██▓▒░                       │    │
│ │ Drums    │ │                                                     │    │
│ ├──────────┤ ├─────────────────────────────────────────────────────┤    │
│ │ + Add    │ │                                                     │    │
│ └──────────┘ └─────────────────────────────────────────────────────┘    │
│                                                                         │
│  Timeline ruler:  0:00     0:30     1:00     1:30     2:00     2:30     │
└─────────────────────────────────────────────────────────────────────────┘
```

**What it includes (Phase 1, all client-side mock — no audio engine yet):**

- **Top transport bar**: play / pause / stop / record / skip buttons (from `lucide-react`), live playhead time display, master BPM input, zoom −/+, snap toggle. Buttons are real React state; clicking play increments the playhead with `requestAnimationFrame`.
- **Track header column (left, ~200px wide)**: per-track name (editable inline), Mute/Solo buttons, volume slider (shadcn `Slider`), color swatch (mustard / orange / forest / cream) acting as track color.
- **Waveform lanes**: each track is a horizontal lane. Render decorative SVG waveforms generated from a seeded random function so they look real. Clips are colored rectangles with the waveform inside; user can drag clips left/right within their lane (simple `pointerdown`/`move` math, no library) and resize from the right edge.
- **Timeline ruler** above lanes with tick marks every second; a vertical playhead line spans all lanes and animates during playback.
- **Add track** button appends a new lane; default 4 starter tracks (Vocals, Drums, Bass, FX) so the page is not empty on first load.
- **State** lives in component `useState` for now (tracks, clips, playhead, BPM). No DB writes — this is a sandbox/editor surface; the existing `/assembly/$setId` set-builder remains for the Spotify-driven flow.
- **Empty-state CTA** in the corner: "Got a setlist? Build it in the Set Studio →" linking to `/` so the two flows stay connected.

**Sidebar update (`AppShell.tsx`)**: Assembly nav item now points to `/assembly` (not `/`). Order stays Beatmaker · Library · Mastering · Assembly · About.

**Intro page (`_app.index.tsx`)**: the "Assembly" link in the destination row stops triggering set creation — it just navigates to `/assembly`. The intention input still creates a set and routes to `/assembly/$setId` (the set-studio flow). That keeps the intention-driven path intact while giving the Assembly tab its own, rich destination.

### Out of scope

- Real audio playback / WebAudio engine (Phase 2). Phase 1 is the visual editor + interaction model.
- Persisting Assembly state to the database.
- Changes to Beatmaker / Library / Mastering / About visuals beyond inheriting the new palette.


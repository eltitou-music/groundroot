## Rebrand to **Pio - Near** + Ghibli-style Welcome page, no sidebar

Translate the two pencil sketches into the live app: rename everything from **Osmose** to **Pio - Near**, redesign the landing page in Studio Ghibli watercolor style (sunset over water, plants below, "Connect the dots" tagline), remove the left sidebar entirely, and rename `/` to `/welcome`.

### 1. Brand rename → **Pio - Near**

- Wordmark everywhere: `Pio - Near` (with spaces around the dash, exactly as in the sketch).
- Tagline under the wordmark: **Connect the dots**.
- Page `<title>`: `Pio - Near — Connect the dots`.
- Update `__root.tsx` meta (title, description, og:title, og:description, twitter) — drop all "Osmose" / "transcend and share yourself…" copy.
- Replace `osmose-breath` class + keyframes with `pio-breath` (functionally identical 6s breathing).
- localStorage theme key `osmose-theme` → `pio-near-theme`, with one-time migration reading the previous key.
- Asset rename: copy `src/assets/osmose-logo.png` to `src/assets/pio-near-logo.png` (we'll regenerate the actual artwork in step 4); switch every import. Old file untouched.
- About page copy: replace any Osmose references with Pio - Near.

### 2. Welcome page — Studio Ghibli scene

Rename `src/routes/_app.index.tsx` semantics: keep the file (route `/`), but its component becomes `WelcomePage` and its content is the new scene. Add a new file `src/routes/_app.welcome.tsx` that mounts the **same** `WelcomePage` component at `/welcome`. Make `/` redirect to `/welcome` via TanStack `redirect()` in a `beforeLoad` so the canonical URL is `/welcome`.

**Layout (matches the sketch closely):**

```text
┌──────────────────────────────────────────────────────────────────┐
│  [tiny Pio - Near logo · top-left]                  [theme tgl] │
│                                                                  │
│   ╭─ ORANGE-RED SUNSET (top band) ─────────────────────────╮    │
│   │   sun · sea horizon · distant lighthouse silhouette    │    │
│   ╰────────────────────────────────────────────────────────╯    │
│   ~~~~~~~~~~~~~~~~~ water ripples ~~~~~~~~~~~~~~~~~~~~~~~      │
│                                                                  │
│              ╔═══════════════════════════════╗                  │
│              ║         Pio - Near            ║   (display)      │
│              ║       Connect the dots        ║   (subtitle)     │
│              ╚═══════════════════════════════╝                  │
│                                                                  │
│        ┌───────────────────────────────────────────┐            │
│        │  Today's intention                        │            │
│        │  [ I want to make a mixtape for…    →]   │  pill input │
│        └───────────────────────────────────────────┘            │
│                                                                  │
│      Beatmaker · Library · Assembly · Mastery · ( ? )           │
│                                              about us            │
│                                                                  │
│   🌿 monstera   🍋 lemon tree   🌱 tall plant   💜 lavender   🌿 basil  │
│   (Ghibli-painted plants spanning the bottom edge, illustrative) │
└──────────────────────────────────────────────────────────────────┘
```

**Implementation details (all client-rendered, no real photographs):**

- **Sky/sunset (top ~38vh)**: a single full-width hero band built from layered CSS radial + linear gradients (deep indigo → coral → warm orange → golden disc). A blurred amber circle at center represents the sun, with two soft horizontal strokes for cloud bands. SVG silhouette of a small lighthouse/cliff on the right horizon.
- **Sea (thin band, ~6vh)**: subtle horizontal SVG ripple lines with low opacity, gradient from coral reflection in the center to deeper teal at the edges.
- **Wordmark**: `Pio - Near` in `Fraunces` display, ~clamp(56px, 9vw, 120px), centered, with a slow `pio-breath` animation. Tagline `Connect the dots` in small caps below, with a thin underline stroke matching the sketch.
- **Intention input**: pill-shaped (already designed pattern), placeholder *"I want to make a mixtape for my girlfriend, make a cool beat, etc."* — preserves the existing handler that creates a `sets` row and routes to `/assembly/$setId`.
- **Destinations row**: dot-separated `Beatmaker · Library · Assembly · Mastery · ?`. The first four are real `<Link>`s to `/beatmaker`, `/library`, `/assembly`, `/mastering`. The `?` is a circle button that links to `/about` with hover label "about us".
- **Plants strip (bottom)**: an SVG illustration row of 5 stylized plants (monstera, lemon tree with small fruit dots, generic tall leafy, lavender stalks, basil). All inline SVG so it inherits theme colors — forest greens for foliage, mustard for lemons, lavender purple for the lavender heads. They sit on a faint cream-to-transparent ground gradient, low opacity (~75%), no harsh edges, hand-drawn stroke style (`stroke-linecap: round`, slight irregular `d` paths) to evoke painted brushwork.

**Ghibli aesthetic technique (no AI art, all CSS/SVG):**

- Round, organic curves; no sharp corners.
- Slightly grainy texture (already present via `body` noise SVG).
- Warm, sun-soaked palette: coral `#E8956B`, sunset orange `#D86A3D`, deep indigo `#2C3E5C`, warm cream sky-base `#F4DEB6`, forest green `#3C5A3F`, lavender `#8A7AB0`, lemon yellow `#E8C547`.
- Soft drop shadows and gentle gradients, not flat fills, so each illustration element feels watercolor-painted.
- Subtle parallax: the sun gets a very slow `breath` scale animation; the plant row gets a 12s sway via `transform: rotate` ±0.5deg on each plant with staggered delays.
- All animations respect `prefers-reduced-motion`.

### 3. Remove the lateral sidebar

- `src/components/layout/AppShell.tsx`: delete the `<aside>` block entirely. Keep a slim sticky top bar that shows the small `Pio - Near` logo + wordmark on the left (linking to `/welcome`) and the `ThemeToggle` on the right. Same bar for mobile and desktop (no more `md:hidden` split).
- Remove unused imports (`Sparkles`, `Layers`, `Music`, `Library`, `Sliders`, `Info`, `Lock`, `useLocation`, `cn`, `navItems`).
- All routes still render their own pages; navigation now happens through the destinations row on the welcome page and direct URLs (the user can also use the back button / browser history).

### 4. Logo redraw

Generate a new `src/assets/pio-near-logo.png` matching sketch v1 — the back of a guitar, shaped like the back of a woman with dark hair on the left side, in the wind, with an arrow piercing through and going into the sun. The arrow has feathers at the bottom of the guitar where the cable comes out and connects in the air. The block square on the right of the guitar represents a square cross.  The arrow goes into a **stylized sun** (radiating pencil-style lines with whiteness in the middle (SPACE) with stars), in the new sunset palette (warm orange sun + deep indigo bow + coral string), transparent background, ~512×512. Used in:

- top-left of `AppShell`
- favicon (via `__root.tsx` `links[rel=icon]`)

### 5. Routing changes

- New file `src/routes/_app.welcome.tsx` → component imports and renders the same `WelcomePage` component used at `/`.
- `src/routes/_app.index.tsx` → keeps file, but adds:
  ```ts
  beforeLoad: () => { throw redirect({ to: "/welcome" }); }
  ```
  so visiting `/` lands on `/welcome` (canonical). The actual UI lives in `_app.welcome.tsx`.
- The route tree (`routeTree.gen.ts`) will regenerate automatically when `_app.welcome.tsx` is created.

### Note on `https://www.pio-near.io/welcome`

The literal domain `pio-near.io` is **outside Lovable's control** — it would need to be purchased and pointed at the project as a custom domain (Lovable Cloud → Custom Domains). What this plan delivers in-app:

- The canonical landing path becomes `/welcome` (e.g., `https://<your-lovable-domain>/welcome`).
- Once you connect `pio-near.io` as a custom domain, that exact URL `https://www.pio-near.io/welcome` will resolve to this Welcome page automatically.

### Files touched

- `src/routes/__root.tsx` — meta + favicon import.
- `src/routes/_app.tsx` — unchanged structurally (still mounts `AppShell`).
- `src/components/layout/AppShell.tsx` — drop sidebar, slim top bar with new wordmark.
- `src/routes/_app.index.tsx` — convert to redirect to `/welcome`.
- `src/routes/_app.welcome.tsx` — new file, holds the Ghibli `WelcomePage` component.
- `src/routes/_app.about.tsx` — copy update (Pio - Near).
- `src/components/theme/ThemeProvider.tsx` — storage key rename + migration from `osmose-theme`.
- `src/styles.css` — rename `osmose-breath` → `pio-breath`; no other palette change required (existing warm palette already fits the sunset).
- `src/assets/pio-near-logo.png` — generated new logo; replaces all `osmose-logo` imports.

### Out of scope

- Buying / configuring the `pio-near.io` domain (user action, outside the codebase).
- Visual redesign of Beatmaker / Library / Mastering / Assembly / About — they continue to inherit theme; only the wordmark/copy is renamed.
- Replacing the existing background image at `public/osmose-bg.png` — the new Welcome page renders its own scene, so the global background sits behind other routes only.
# GroundRoot — Demo runbook

> From quiet intention to proud expression in one breath.

The demo is the breath: **S0 → S5** in one sitting. A stranger drops their tracks
in and a real, blended, mastered set leaves the app.

## The flow (what to show)

| Stage | Route | The moment |
|---|---|---|
| **S0** Welcome | `/welcome` | One intention → the companion reflects it back → into the dig. |
| **S1** Dig | `/set/$setId/dig` | Drag in your own tracks **or** tap the demo crate. Covers + names only — no numbers. |
| **S2** Clean up | `/set/$setId/order` | Drag to order by feel. "Propose an order" suggests an arc with a why — keep it or put it back. "Show the numbers" reveals BPM/key/energy. |
| **S3** Play | `/set/$setId/play` | Press play: one continuous blended set, **one** progress bar, the companion's line at each blend. |
| **S4** Polish | `/set/$setId/polish` | Name it, pick a colour, one **Polish** button → master render → celebration. |
| **S5** Door | `/set/$setId/door` | Real **mp3** download · the **set sheet** (notes & cues, print/PDF) · simulated SoundCloud post · the €99 founders door. |

## Before the demo (founder prerequisites)

1. **Supabase**: set `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` in `.env`
   (see `.env.example`). **Enable the Anonymous auth provider** in the Supabase
   dashboard (Authentication → Providers → Anonymous) — this is a hard blocker; the
   app needs it to start a session and persist sets.
2. **Demo crate audio**: drop the three rights-free files into `public/demo-crate/`
   with the filenames in `public/demo-crate/manifest.json`
   (`under-control.mp3`, `di-mi-quando.mp3`, `promises-parralox-remix.mp3`).
   Until then, run `node scripts/gen-demo-crate.mjs` to write synth placeholders so
   the path is testable. Confirm/adjust the hand-authored BPM/key/energy in the manifest.
3. **Stripe**: set `VITE_STRIPE_FOUNDERS_LINK` to the real Payment Link (optional —
   falls back to a placeholder). The "871 / 1,000 left" counter is static for the demo.

## Running

```bash
npm install --legacy-peer-deps   # bun.lockb pins a private registry; npm is the portable path
cp .env.example .env             # then fill in the values
npm run dev                      # http://localhost:8080
```

> Note: the Lovable vite config binds to the sandbox's host/port automatically.

## Offline-safe (hotel wifi down)

The happy path is built to survive no network:
- The demo crate is served same-origin from `public/demo-crate/`.
- Own-file uploads fall back to in-memory playback (`URL.createObjectURL`) when storage is unreachable.
- Set + tracks are mirrored to `localStorage`; reads race a 4s timeout and hydrate from the mirror on failure.
- The welcome companion line has a scripted offline twin — indistinguishable from the live AI.
- mp3 export and the set sheet are fully client-side.

**Drill before the room:** start `npm run dev`, turn wifi off, run the whole breath on the demo crate.

## Risks / knobs

- **Memory**: S3 streams audio (low memory). The S4 render decodes fully — for the demo,
  4–6 tracks render cleanest. Cap copy is ready if you push past ~8 long tracks.
- **Crossfade**: 6s equal-power (`CROSSFADE_SEC` in `src/utils/render.ts`). The demo crate is
  tempo-close so blends land without real beatmatching.
- **mp3**: `@breezystack/lamejs`, dynamically imported, 192 kbps; wav fallback if it ever throws.

## Telemetry (the Freeze-Map moat)

Every step logs to the `events` table (fire-and-forget): `intention_set`, `coach_replied`,
`upload_*`, `demo_crate_added`, `crate_full_hit`, `track_removed`, `details_toggled`,
`tracks_reordered`, `automix_*`, `set_played`, `transition_reached`, `playback_stalled`,
`set_polished`, `set_exported`, `blueprint_exported`, `soundcloud_simulated`, `buy_clicked`.

Audit with: `select name, count(*) from events group by 1 order by 2 desc;`

## Design laws (don't break under pressure)

Feel-first (no numbers on S0/S1) · companion validates, never autopilots · one thing per
screen · the set is ONE thing (one progress bar) · private-first. The companion's voice and
the dj-companion / flow-ux principles live in `docs/skills/`.

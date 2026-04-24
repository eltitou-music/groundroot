# GroundRoot v0.9 — Plan

## North star (from Tristan's intention notes)

- Software for artistic expression that **removes friction between intention and output**
- **Play first, curate second** — Tyler the Creator's "create like an artist, curate like a scientist"
- Calm, child-like, inviting — works *with* an ADHD mind, not against it
- Every screen should feel like it's transmitting from a place of love, not anxiety

Three principles drive every change below:

1. **One breath to start.** Never more than one input between the user and sound.
2. **Play, then keep.** Capture happens silently in the background; the user is never asked "do you want to save this?"
3. **One spine.** Beatmaker → Library → Assembly → Mastery is one continuous river. Each pillar hands off to the next with the *same intention* preserved.

---

## What's there today (honest read)


| Pillar    | State                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Friction we'll remove                                                                | &nbsp;                                                                      | &nbsp; |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ------ |
| Welcome   | Beautiful, but pushes everyone straight into Assembly via `sets` insert                                                                                                                                                                                                                                                                                                                                                                                              | Asks for a setlist before the user has played a note                                 | &nbsp;                                                                      | &nbsp; |
| Beatmaker | Functional 6-voice 32-step grid. Include options for house, r&b, jazz, electronic, techno & other styles of beats. Keep it 10 max                                                                                                                                                                                                                                                                                                                                    | Dead-end: nothing carries forward; voices named like a drum machine, not like a body | &nbsp;                                                                      | &nbsp; |
| Library   | Prompt + suggestions + multi-source aggregation works well. Digest the description of the sound into something comestible for the user, not just the plain text from the archive tool, keep the source name minimal, almost invisble. Add a visual descriptor of the sound, with some animation too (ex: falling raindrops, moving air in the bushes, etc.)                                                                                                          | Results don't feed Assembly; no preview audio in-card                                | &nbsp;                                                                      | &nbsp; |
| Assembly  | Should have 5 tracks to start with an easy to access button at the bottom to add more. We want SPACE for the user to think and get creative.                                                                                                                                                                                                                                                                                                                         | &nbsp;                                                                               | Confusing — one is a fake DAW, the other is the real intention-anchored set | &nbsp; |
| Mastery   | This place should feel like the pressure cooker where you are burning to release the set because it's so good. It should give you the showcase of the entire track/set in the middle, show the energy level throughout the set, and at the top give intelligent options to improve it overall (reduce clipping, adapt for club, or studio, add more bass on transitions, repair, etc.). Then it should have buttons in the top right to SHARE to SoundCloud to start | &nbsp;                                                                               | Disconnected from the set being assembled                                   | &nbsp; |


---

## The plan — five focused moves

### Move 1 — Welcome becomes a **fork, not a funnel**

Today the welcome page only knows one verb: "start a set". That's too heavy when the user just wants to *play*.

Change the intention input behavior:

- The four destination words below the input (`Beatmaker · Library · Assembly · Mastery`) become **the actual decision** — when the user types an intention and hits one, we route there *with the intention attached as a query param*.
- Default action on Enter / arrow stays the current "start a set", but it's no longer the only door.
- Templates (Sunset brunch, Techno night…) gain the same fork — long-press / right-side dot to choose where they land.

Result: a 27-year-old with ADHD can type "make a cool beat" + tap **Beatmaker** and be in the grid in one tap, with that intention pinned at the top.

### Move 2 — Beatmaker: **Play Mode** + silent capture

Reframe the page around play, not production.

- **Voices renamed** to body words: Heart (kick), Clap (snare), Whisper (hat), Spark (perc). Same sounds — different invitation.
- **"Just play" empty state**: when the grid is blank, a single ghost row pulses gently; tapping anywhere starts a 4-on-the-floor seed so there's *always* sound within one tap.
- **Silent capture**: every pattern the user touches is auto-saved to a per-session `sketches` row (no "Save" button, ever). A small "Sketches today" pill at the bottom shows the last 3 — tap one to recall it, swipe to discard.
- **Hand-off to Library**: a single button "Find sounds that fit this" sends the current BPM + pattern fingerprint as the Library prompt seed.
- **Hand-off to Assembly**: "Plant in a set" creates a `sets` row (with intention from welcome if present) and drops the loop in as track 1.

Keep current audio engine as-is — only UI/copy + a `localStorage`-backed sketch stack (DB optional in v0.9).

### Move 3 — Library: **preview-in-card** + send-to-Assembly

The aggregator already works. What's missing is the closing of the loop.

- **Inline preview**: each `TrackCard` gets a 30s preview button (Internet Archive results expose `audio` files in the JSON; FMA/OMA fall back to "open source" link as today).
- **Source attribution stays bottom-left** (already shipped — keep).
- **"Add to set" pill**: appears on hover/focus. If the user has an active set (from welcome) it adds to that set's tracks; if not, it offers two paths in a tiny popover: *Start a set with this* / *Save to my crate*.
- **Trust line stays**: the existing `reason` field ("why we picked this") is now bolder — moved up next to the title at small text size, italic.

### Move 4 — Assembly: **collapse two surfaces into one**

Right now `/assembly` is a generic timeline workspace and `/assembly/$setId` is the intention-anchored set. That's two answers to the same question.

- `/assembly` (no id) becomes a **list of the user's sets** (intention pinned, last-edited timestamp, cover gradient) + a "New set" button. No timeline mock.
- `/assembly/$setId` is the *only* editor — keep current SourcesPanel / TransitionMap / CoPilot / IntentionPin layout.
- **Carryover from Beatmaker / Library**: when arriving with `?from=beatmaker&sketchId=…` or `?from=library&trackIds=…`, pre-populate the set and toast "Brought your sketch over."
- **Empty-state seedling**: when a set has zero tracks, show the `RootSystem` SVG faintly behind the grid with copy "This set is still a seed — drop a sound in."

### Move 5 — Mastery: **bind to the active set**

Mastery is currently a sandbox of sliders. Bind it to a set.

- Route becomes `/mastering/$setId` (with `/mastering` redirecting to the most recent set, or showing a chooser if none).
- Header reads the set's `intention` and renames the export action: "Render *Sunset brunch* master".
- Rename presets to **soil profiles** to match the metaphor (already in the prior plan, never shipped):
  - Club soundsystem → **Festival ground**
  - Streaming (DSP) → **Open field**
  - Headphones → **Forest floor**
  - Car stereo → **Open road**
- Export remains disabled placeholder (no DSP yet) but the UI now feels like the *end* of one journey, not a standalone tool.

---

## Cross-cutting polish (cheap, high-impact)

- **Replace anonymous sign-in trigger** on welcome with a deferred trigger — user only gets a session when they *actually* commit to a set or save a sketch. Today every page-load with intention text creates a session, which clutters the DB.
- **Page metadata cleanup**: Beatmaker still says "Pio - Near" in `<head>`, Mastery same, welcome route file too. Sweep all four to GroundRoot with per-page social previews.
- **Consistent back affordance**: every pillar's "← Back" goes to `/welcome` today. Keep, but add a soft breadcrumb under the H1 showing the carried intention ("from your intention: *Sunset brunch*") when present — this is the visible thread that ties the spine together.

---

## Technical sketch (for reference, skip if non-technical)

```text
welcome
 ├─ intention typed
 ├─ chooses destination chip → routed with ?intention=…
 └─ (no DB write until commit)

beatmaker
 ├─ localStorage: gr.sketches[] (id, bpm, pattern, ts)
 ├─ "Find sounds that fit"  → /library?seed=<sketchId>
 └─ "Plant in a set"        → POST sets, POST tracks, → /assembly/$setId

library
 ├─ preview button uses IA's audio.* file URLs (already in API response)
 ├─ "Add to set" → POST tracks(set_id, source_url, source, title, artist)
 └─ trust line ("why") promoted next to title

assembly
 ├─ /assembly             → list of user's sets (replaces timeline mock)
 ├─ /assembly/$setId      → existing intention-anchored editor (kept)
 └─ accepts ?from=…&sketchId|trackIds for handoff

mastering
 ├─ /mastering            → redirect to latest set or chooser
 └─ /mastering/$setId     → existing UI, bound to set, renamed presets
```

DB-wise this only needs:

- A `sketches` table (optional in v0.9 — `localStorage` is fine for first cut)
- `tracks` to accept Library imports (likely already supports it; will verify before writing migration)

No new dependencies. No edge functions. No external API keys. Purely composition + copy + routing changes on top of what we shipped.

---

## What I'm explicitly *not* doing in v0.9

- Real DSP / mastering engine (still placeholder export)
- Real audio rendering in Assembly timeline
- Sample-chopping in Beatmaker
- AI features beyond the existing CoPilot panel — Tristan's note is about removing friction, not piling on AI

---

## Order of work (one batch each, in build mode)

1. Welcome: chip-as-fork + deferred auth + meta sweep
2. Beatmaker: copy + sketch capture + two hand-off buttons
3. Library: preview button + add-to-set + trust line promotion
4. Assembly: split surfaces (list vs editor) + intention breadcrumb + handoff acceptance
5. Mastery: bind to set + soil-profile rename + intention-aware export label

Approve and I'll start with move 1.
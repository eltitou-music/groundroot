# Fluid DJ — Phase 1 Refined: Assembly with Spotify + Google Drive

Focus narrows to **Assembly**, with two big additions: import directly from your Spotify playlists and Google Drive, and a visual transition map with an AI co-pilot that helps you sequence the set so the intention lands.

## The flow

1. **Intro page** — quick warm hello, captures your **intention** (one sentence, free text). Stored and pinned to the top of Assembly so the AI always knows what you're shaping. Skippable if you already know. Here it allows the user to drop the full set/EP vision : what is the composition of the EP, what occasion are you making it for, what are the sets made of, what is the desired cover pictures, existing tracklist, notes, thoughts, fears. Drop it all in one GO
2. **Assembly page** — the heart. Everything below.
3. *(Other pages — beatmaker, library, mastering, about — stay greyed-out "coming soon" so the architecture is visible.)*

## Assembly page — layout

Three zones in one calm screen:

- **Left: Sources panel** — tabs for **Spotify**, **Google Drive**, **Upload**, **Paste setlist**, **Photo of setlist**
- **Center: Visual transition map** — your set as a flowing horizontal/vertical chain of track nodes
- **Right: AI co-pilot chat** — visual, conversational, intention-aware

### Left — Sources (import easily, listen freely)

**Spotify connection**

- Connect your Spotify account (OAuth, read-only — we never publish or modify anything)
- Browse your playlists, pick tracks to pull into your set
- Each imported track can be played in full plus metadata Spotify exposes: title, artist, BPM (tempo), key, energy, danceability, valence
- For full-length playback while building: if you have Spotify Premium, the Spotify Web Playback SDK streams the full track inside the app. Without Premium, you get the 30s preview + all the metadata for sequencing decisions.
- Honest note shown in UI: "Spotify tracks play here for set-building only. They aren't downloaded or exported."

**Google Drive connection**

- Connect your Drive & import select tracks with drag and drop
- Browse folders, pick your field recordings, sound effects, voice notes, stems — anything audio
- Files stream directly from Drive into the in-app waveform player; nothing is copied or re-hosted
- Auto-detects audio files (MP3/WAV/M4A/FLAC/OGG)

**Other sources** (already in the plan)

- Direct upload (for files not in Drive) in accepted musicle formats (WAV, MP3, M4A, etc.)
- Paste setlist as text → AI parses
- Photo of paper setlist → AI OCR + parses

### Center — Visual transition map

Not just a list. A **map** of your set:

- Each track is a **node** with: title, artist, key (Camelot wheel color), BPM, energy ring, source icon (Spotify / Drive / Upload)
- Nodes connect with a **flowing line** representing the transition. Line color/thickness encodes transition quality:
  - Green flowing line = harmonically + rhythmically smooth
  - Amber dashed = workable with effort (key clash, big BPM jump)
  - Red dotted = abrupt (good for intentional drama, flagged so you know)
- Hover/click a transition line → a **transition card** appears: "Camelot 8A → 9A (perfect +1), BPM 122→124, energy 6→7. Try a 16-bar EQ swap at 2:14. Drop a low-pass sweep here?"
- **Sound-effect drop zones** between nodes — drag any Drive sound (riser, impact, vocal chop) onto a transition; it shows as a small chip on the connecting line
- **Energy curve** runs underneath the map, with your intention's "ideal arc" ghosted behind so you see at a glance whether the story is landing
- Drag nodes to reorder; the map re-evaluates all transitions live
- **Cue points** per track: drag mix-in / mix-out markers on each node's mini-waveform

### Right — AI co-pilot (visual + conversational)

Since your ideation is done and you need help **building it right**, the co-pilot is tuned for sequencing and intention-fidelity, not brainstorming:

- **Always sees**: your intention, the current map, the track you're hovering on
- **Visual responses**: when it suggests a reorder, the map animates to show the proposed sequence side-by-side with current. Accept / tweak / reject.
- **Quick-action chips**:
  - *Does this match my intention?* → highlights tracks that drift, suggests fixes
  - *Suggest the next track* → scans your imported pool (Spotify + Drive) for best fits
  - *Where should I add a sound effect?* → highlights transitions that would benefit, suggests effects from your Drive folder
  - *Review my arc* → annotates the energy curve with notes ("the dip at track 4 risks losing momentum given your 'slow burn → euphoric' intention")
  - *Why does this transition work / not work?* → plain-language harmonic + rhythmic explanation
- **Free-text chat**: "I want track 7 to feel like a sunrise — what should come right before?" Co-pilot answers and proposes a visual change you can apply.
- **Tone**: encouraging, beginner-aware, never condescending. Celebrates good instincts.

## Persistence & sessions

- Auth so your set, intention, imported track references, cue points, and effect placements all save
- We store **references** to Spotify track IDs and Drive file IDs, plus your annotations — never the audio itself

## Honest limits (called out in UI)

- **Spotify full playback** requires Premium (Web Playback SDK limitation). Free accounts get 30s previews + all metadata.
- **Drive files** stream from your Drive; they need to remain accessible there.
- This tool is for **building and rehearsing** sets. Performing live with real DJ software, or publishing/exporting a finished mix, comes in the later Mastering phase (and will require licensed audio you actually own).

## Tech foundation

- **Lovable Cloud** — auth, database (intentions, sets, track references, cue points, effect placements, transition notes)
- **Spotify Web API** + **Web Playback SDK** — OAuth login, playlist browsing, metadata (BPM/key/energy via audio-features), in-app playback for Premium users
- **Google Drive connector** (Lovable connector) — OAuth, browse, stream audio files
- **Lovable AI** — intention extraction, transition analysis, sequencing suggestions, sound-effect placement ideas, OCR for paper setlists
- **WaveSurfer.js** — waveforms for uploaded + Drive files; cue-point markers
- **React Flow** (or similar) — the visual transition map with draggable nodes and animated transition lines
- **Camelot wheel logic** — harmonic compatibility scoring driving the map's line colors

## Design

Clean & minimal — Notion/Linear calm. Off-white canvas, one warm coral accent for energy peaks and AI highlights. The transition map is the only "rich" visual — soft gradients, gentle motion, never busy. Optional dark mode for late-night sessions.

## What's NOT in this phase (still architected for later)

- Beatmaker, sound-archive browser, mastering, about/contribute — greyed nav items
- Exporting a playable mixed file (needs licensing + DSP work — honest "later" item)
- Live performance mode
import { zipSync, strToU8 } from "fflate";
import type { MirroredSet, MirroredTrack } from "@/utils/set-mirror";
import { loadTransitions, effectiveFade, type TransitionSetting } from "@/utils/transitions";
import { downloadBlob, filenameFor } from "@/utils/mp3-encode";

/**
 * "To the booth" export — a real Rekordbox DJ_PLAYLISTS XML (with per-track
 * cue points) plus an .m3u8 set queue, zipped together. The DJ relinks the
 * audio in Rekordbox; cues mark the mix-in / mix-out points the set was
 * blended on, so the booth performance matches what GroundRoot built.
 */

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function fileNameFromUrl(t: MirroredTrack): string {
  // Best-effort original filename for the POSITION path the DJ relinks to.
  const base = (t.artist ? `${t.artist} - ${t.title}` : t.title).replace(/[\\/:*?"<>|]+/g, "_");
  return `${base}.mp3`;
}

type Cue = { num: number; type: 0 | 4; start: number; end?: number; name: string };

/** Cue points for a track: mix-in, mix-out (from the next boundary's fade), loop if set. */
function cuesFor(t: MirroredTrack, mixOutFade: number | null): Cue[] {
  const cues: Cue[] = [];
  const dur = t.duration ?? 0;
  const mixIn = t.cue_in ?? 0;
  cues.push({ num: 0, type: 0, start: round(mixIn), name: "mix in" });
  if (mixOutFade !== null && dur > 0) {
    const mixOut = Math.max(mixIn + 1, dur - mixOutFade);
    cues.push({ num: 1, type: 0, start: round(mixOut), name: "mix out" });
  }
  if (t.cue_out !== null && t.cue_out !== undefined && dur > 0) {
    // A loop hint near the tail if the DJ marked one.
    cues.push({
      num: 2,
      type: 4,
      start: round(t.cue_out),
      end: round(Math.min(dur, t.cue_out + 8)),
      name: "loop",
    });
  }
  return cues;
}

function round(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/**
 * Rekordbox DJ Playlists XML. Per the booth spec: <DJ_PLAYLISTS> root, a
 * <NODE> per track carrying <POSITION> (file path) and <CUE> entries
 * (NUM/TYPE/START/[END]/[BEAT]/[NAME], float seconds).
 */
export function buildRekordboxXml(
  set: MirroredSet,
  tracks: MirroredTrack[],
  transitions: TransitionSetting[],
): string {
  const ordered = [...tracks].sort((a, b) => a.position - b.position);
  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(`<DJ_PLAYLISTS Version="1.0.0">`);
  lines.push(`  <PRODUCT Name="GroundRoot" Version="1.0" Company="GroundRoot"/>`);
  lines.push(`  <PLAYLISTS>`);
  lines.push(`    <NODE Type="0" Name="ROOT" Count="1">`);
  lines.push(
    `      <NODE Name="${xmlEscape(set.title || "GroundRoot set")}" Type="1" Entries="${ordered.length}">`,
  );

  ordered.forEach((t, i) => {
    const fade =
      i < ordered.length - 1 ? effectiveFade(transitions[i] ?? ({} as TransitionSetting)) : null;
    const cues = cuesFor(t, fade);
    const attrs = [
      `Name="${xmlEscape(t.title)}"`,
      `Artist="${xmlEscape(t.artist ?? "")}"`,
      t.bpm ? `AverageBpm="${Math.round(t.bpm)}"` : "",
      t.camelot_key ? `Tonality="${xmlEscape(t.camelot_key)}"` : "",
      t.duration ? `TotalTime="${Math.round(t.duration)}"` : "",
    ]
      .filter(Boolean)
      .join(" ");
    lines.push(`        <NODE ${attrs}>`);
    lines.push(`          <POSITION>${xmlEscape(fileNameFromUrl(t))}</POSITION>`);
    cues.forEach((c) => {
      const parts = [`NUM="${c.num}"`, `TYPE="${c.type}"`, `START="${c.start.toFixed(3)}"`];
      if (c.end !== undefined) parts.push(`END="${c.end.toFixed(3)}"`);
      parts.push(`NAME="${xmlEscape(c.name)}"`);
      lines.push(`          <CUE ${parts.join(" ")}/>`);
    });
    lines.push(`        </NODE>`);
  });

  lines.push(`      </NODE>`);
  lines.push(`    </NODE>`);
  lines.push(`  </PLAYLISTS>`);
  lines.push(`</DJ_PLAYLISTS>`);
  return lines.join("\n");
}

/** Extended M3U set queue (the play order, durations, titles). */
export function buildM3U8(set: MirroredSet, tracks: MirroredTrack[]): string {
  const ordered = [...tracks].sort((a, b) => a.position - b.position);
  const lines: string[] = ["#EXTM3U", `#PLAYLIST:${set.title || "GroundRoot set"}`];
  ordered.forEach((t) => {
    const secs = Math.round(t.duration ?? 0);
    const label = t.artist ? `${t.artist} - ${t.title}` : t.title;
    lines.push(`#EXTINF:${secs},${label}`);
    lines.push(fileNameFromUrl(t));
  });
  return lines.join("\n");
}

const README = (setTitle: string) =>
  [
    `${setTitle} — GroundRoot booth export`,
    ``,
    `Files:`,
    `  • rekordbox.xml   — import in rekordbox: File ▸ Preferences ▸ Advanced ▸`,
    `                       Database ▸ rekordbox xml, set this file, then find it`,
    `                       under "rekordbox xml" in the tree. Cue points mark the`,
    `                       mix-in and mix-out of every track.`,
    `  • set-queue.m3u8  — the play order for Serato / VirtualDJ / most players.`,
    ``,
    `The track paths point to your own files by name — relink them in rekordbox`,
    `if it asks. The set was blended in GroundRoot; these cues match it.`,
  ].join("\n");

/** Build the booth zip and trigger a download. */
export function exportBooth(
  set: MirroredSet,
  tracks: MirroredTrack[],
  transitionsOverride?: TransitionSetting[],
): void {
  const boundaries = Math.max(0, tracks.length - 1);
  const transitions = transitionsOverride ?? loadTransitions(set.id, boundaries);
  const xml = buildRekordboxXml(set, tracks, transitions);
  const m3u = buildM3U8(set, tracks);
  const zipped = zipSync({
    "rekordbox.xml": strToU8(xml),
    "set-queue.m3u8": strToU8(m3u),
    "README.txt": strToU8(README(set.title || "GroundRoot set")),
  });
  // Copy into a fresh ArrayBuffer so Blob gets a clean BlobPart (avoids
  // SharedArrayBuffer typing friction).
  const out = new Uint8Array(zipped.length);
  out.set(zipped);
  downloadBlob(
    new Blob([out], { type: "application/zip" }),
    filenameFor(set.title || "groundroot-set", "booth.zip"),
  );
}

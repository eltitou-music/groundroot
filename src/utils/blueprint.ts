import {
  combinedTransitionQuality,
  scoreKeyTransition,
  scoreBpmTransition,
  type TransitionQuality,
} from "@/lib/camelot";
import type { MirroredSet, MirroredTrack } from "@/utils/set-mirror";

/**
 * The set blueprint — the dj-companion's first deliverable: a performable
 * sheet the DJ executes with their own hands. Transition lines are PROMPTS,
 * not a script: they point at the move and the feel, then get out of the way.
 * Works whether or not the set was ever rendered.
 */

export type BlueprintTransition = {
  quality: TransitionQuality;
  keyMove: string | null; // "8A → 9A" etc.
  bpmMove: string | null; // "118 → 121 (+3)"
  prompt: string; // a move to execute, in the companion's voice
};

export type BlueprintTrack = {
  index: number;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  energy: number | null;
  phase: string; // warmup / build / peak / release
  cuePrompt: string;
  notes: string | null;
};

export type Blueprint = {
  title: string;
  intention: string | null;
  dedicatedTo: string | null;
  arc: string; // glyph line, e.g. "○ ◔ ◑ ◕ ●"
  tracks: BlueprintTrack[];
  transitions: BlueprintTransition[]; // length = tracks.length - 1
};

/** Four-phase energy arc label for a track at position i of n. */
function phaseFor(i: number, n: number): string {
  if (n <= 1) return "the whole set";
  const p = i / (n - 1);
  if (p < 0.25) return "warmup";
  if (p < 0.6) return "build";
  if (p < 0.85) return "peak";
  return "release";
}

const ARC_GLYPHS = ["○", "◔", "◑", "◕", "●"];

function arcLine(n: number): string {
  if (n <= 1) return "●";
  return Array.from({ length: n }, (_, i) => {
    const g = Math.round((i / (n - 1)) * (ARC_GLYPHS.length - 1));
    return ARC_GLYPHS[g];
  }).join(" ");
}

function cuePrompt(t: MirroredTrack): string {
  if (t.cue_in !== null || t.cue_out !== null) {
    const parts: string[] = [];
    if (t.cue_in !== null) parts.push(`in around ${fmtTime(t.cue_in)}`);
    if (t.cue_out !== null) parts.push(`out around ${fmtTime(t.cue_out)}`);
    return parts.join(", ");
  }
  return "find your loop point in the last 32 bars";
}

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** A transition prompt: name the move, point at the feel, leave the call to them. */
function transitionPrompt(
  from: MirroredTrack,
  to: MirroredTrack,
  quality: TransitionQuality,
): string {
  const keyQ = scoreKeyTransition(from.camelot_key, to.camelot_key);
  const bpmQ = scoreBpmTransition(from.bpm, to.bpm);

  if (quality === "smooth") {
    if (keyQ === "smooth") {
      return "long blend — they share a key, so EQ the lows across slowly and let them sit together for 16.";
    }
    return "bass swap on the 16 — you'll feel where the low end wants to change hands.";
  }
  if (quality === "workable") {
    if (bpmQ === "abrupt") {
      return "ride the tempo in over a phrase — nudge the incoming up to meet it before you commit the bass.";
    }
    return "high-pass the incoming track to slot it above this one, then resolve on the drop.";
  }
  // abrupt
  return "this one's a statement — cut it in clean on a phrase boundary, or echo the outgoing out. Your call.";
}

export function buildBlueprint(set: MirroredSet, tracks: MirroredTrack[]): Blueprint {
  const ordered = [...tracks].sort((a, b) => a.position - b.position);
  const n = ordered.length;

  const bpTracks: BlueprintTrack[] = ordered.map((t, i) => ({
    index: i + 1,
    title: t.title,
    artist: t.artist ?? "Unknown",
    bpm: t.bpm,
    key: t.camelot_key,
    energy: t.energy,
    phase: phaseFor(i, n),
    cuePrompt: cuePrompt(t),
    notes: t.notes,
  }));

  const transitions: BlueprintTransition[] = [];
  for (let i = 0; i < n - 1; i++) {
    const a = ordered[i];
    const b = ordered[i + 1];
    const quality = combinedTransitionQuality(a.camelot_key, b.camelot_key, a.bpm, b.bpm);
    const keyMove = a.camelot_key && b.camelot_key ? `${a.camelot_key} → ${b.camelot_key}` : null;
    const bpmMove =
      a.bpm && b.bpm
        ? `${Math.round(a.bpm)} → ${Math.round(b.bpm)} (${b.bpm > a.bpm ? "+" : ""}${Math.round(b.bpm - a.bpm)})`
        : null;
    transitions.push({ quality, keyMove, bpmMove, prompt: transitionPrompt(a, b, quality) });
  }

  return {
    title: set.title || "Untitled set",
    intention: set.intention,
    dedicatedTo: set.dedicated_to,
    arc: arcLine(n),
    tracks: bpTracks,
    transitions,
  };
}

/** Render the blueprint as Markdown for a .md download. */
export function blueprintToMarkdown(bp: Blueprint): string {
  const lines: string[] = [];
  lines.push(`# ${bp.title}`);
  lines.push("");
  if (bp.intention) lines.push(`*${bp.intention}*`);
  if (bp.dedicatedTo) lines.push(`For ${bp.dedicatedTo}.`);
  lines.push("");
  lines.push(`**Energy arc:** ${bp.arc}  (warmup → build → peak → release)`);
  lines.push("");
  lines.push("---");
  lines.push("");

  bp.tracks.forEach((t, i) => {
    const meta = [t.key, t.bpm ? `${Math.round(t.bpm)} BPM` : null].filter(Boolean).join(" · ");
    lines.push(`### ${t.index}. ${t.title} — ${t.artist}`);
    lines.push(`*${t.phase}*${meta ? ` · ${meta}` : ""}`);
    lines.push(`- Cue: ${t.cuePrompt}`);
    if (t.notes) lines.push(`- Note: ${t.notes}`);
    const tr = bp.transitions[i];
    if (tr) {
      const move = [tr.keyMove, tr.bpmMove].filter(Boolean).join("  ·  ");
      lines.push("");
      lines.push(`  ↳ **into the next** (${tr.quality}${move ? ` · ${move}` : ""}): ${tr.prompt}`);
    }
    lines.push("");
  });

  lines.push("---");
  lines.push("");
  lines.push("_Made with GroundRoot — from quiet intention to proud expression in one breath._");
  return lines.join("\n");
}

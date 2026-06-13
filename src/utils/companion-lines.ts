import { hashString } from "@/lib/utils";
import type { TransitionQuality } from "@/lib/camelot";

/**
 * The companion's voice, in one place.
 *
 * Voice rules (dj-companion): short, no preamble, no homework, no cheesy
 * closers. Talk to a sharp adult. Validate — never take over. The companion
 * mirrors what the DJ did; it never claims the move as its own.
 *
 * Picks are deterministic (hash of a seed) so the same moment reads the same
 * across re-renders, but we never repeat the immediately previous line.
 */

let lastLine = "";

function pick(pool: readonly string[], seed: string): string {
  if (pool.length === 0) return "";
  let idx = hashString(seed) % pool.length;
  if (pool.length > 1 && pool[idx] === lastLine) idx = (idx + 1) % pool.length;
  lastLine = pool[idx];
  return pool[idx];
}

/* ----- S3: lines that fade in as a blend happens ----- */

const TRANSITION_LINES: Record<TransitionQuality, readonly string[]> = {
  smooth: [
    "nice flow.",
    "that blend works.",
    "these two were waiting for each other.",
    "seamless — the room wouldn't blink.",
    "clean. barely a seam.",
  ],
  workable: [
    "interesting pairing — it holds.",
    "there's tension in this one. it lands.",
    "a stretch, and it pays off.",
    "you made that work.",
  ],
  abrupt: [
    "bold jump — owning it.",
    "that's a statement, not an accident.",
    "hard cut energy. intentional drama.",
    "risky — and it's yours.",
  ],
};

export function transitionLine(quality: TransitionQuality, seed: string): string {
  return pick(TRANSITION_LINES[quality], `${quality}:${seed}`);
}

/* ----- S2: the one-line "why" under an Automix proposal ----- */

export type ArcShape = "ramp" | "wave" | "descent";

const AUTOMIX_WHY: Record<ArcShape, string> = {
  ramp: "Starts low, peaks near the end — the classic warm-up arc. Yours to change.",
  wave: "Rises, breathes, rises again — tension and release. Yours to change.",
  descent: "Opens high and eases down — a comedown shape. Yours to change.",
};

export function automixWhy(shape: ArcShape): string {
  return AUTOMIX_WHY[shape];
}

/* ----- S4: celebration when the master finishes ----- */

const CELEBRATION_LINES = [
  "It's done. That's the whole job.",
  "You finished it. Most people never do.",
  "One breath, one set. It's real now.",
  "This exists because you made it exist.",
] as const;

export function celebrationLine(seed: string): string {
  return pick(CELEBRATION_LINES, `celebrate:${seed}`);
}

/* ----- Stalls / long waits — never silence ----- */

const STALL_LINES = [
  "still here — big files take a moment.",
  "working on it. nothing's lost.",
  "almost — keep breathing.",
] as const;

export function stallLine(seed: string): string {
  return pick(STALL_LINES, `stall:${seed}`);
}

/* ----- S0: offline / timeout fallback for the welcome coach -----
 * Mirrors the intention back so the DJ feels heard, then points at the dig.
 * Must be indistinguishable in tone from the live coach.
 */

const WELCOME_SHAPES = [
  (gist: string) => `${gist} — good. Let's find the tracks that already know this feeling.`,
  (gist: string) => `${gist}. Hold that. The crate comes next.`,
  (gist: string) => `${gist} — that's a real place to start. Bring the tracks that live there.`,
] as const;

/** Pull a short, lowercase gist from the intention for mirroring back. */
function gistOf(intention: string): string {
  const head = intention.split(/[—–\-:,.]/)[0]?.trim() || intention.trim();
  const short = head.length > 48 ? head.slice(0, 48).trim() + "…" : head;
  return short.charAt(0).toLowerCase() + short.slice(1);
}

export function welcomeFallback(intention: string): string {
  const shape = WELCOME_SHAPES[hashString(intention) % WELCOME_SHAPES.length];
  return shape(gistOf(intention));
}

/* ----- S5: a release blurb in their voice (simulated SoundCloud prefill) ----- */

export function releaseBlurb(intention: string | null, dedicatedTo: string | null): string {
  const parts: string[] = [];
  if (intention) parts.push(intention.trim().replace(/\.$/, "") + ".");
  parts.push("Mixed in one sitting, start to finish.");
  if (dedicatedTo) parts.push(`For ${dedicatedTo.trim()}.`);
  return parts.join(" ");
}

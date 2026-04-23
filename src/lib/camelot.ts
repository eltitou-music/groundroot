/**
 * Camelot wheel logic — harmonic compatibility scoring for DJ transitions.
 * Keys are like "8A", "9B" (1A..12A inner, 1B..12B outer).
 */

export type TransitionQuality = "smooth" | "workable" | "abrupt";

const KEY_RE = /^(\d{1,2})([AB])$/;

function parseKey(k?: string | null): { num: number; letter: "A" | "B" } | null {
  if (!k) return null;
  const m = k.trim().toUpperCase().match(KEY_RE);
  if (!m) return null;
  const num = parseInt(m[1], 10);
  if (num < 1 || num > 12) return null;
  return { num, letter: m[2] as "A" | "B" };
}

function ringDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 12;
  return Math.min(d, 12 - d);
}

/**
 * Score a key transition. Returns:
 *  - "smooth" : same key, ±1 on the wheel, or relative major/minor (same number, swap letter)
 *  - "workable": ±2 on the wheel, or "energy boost" (+7 semitones)
 *  - "abrupt": anything else
 */
export function scoreKeyTransition(fromKey?: string | null, toKey?: string | null): TransitionQuality | null {
  const a = parseKey(fromKey);
  const b = parseKey(toKey);
  if (!a || !b) return null;

  if (a.num === b.num && a.letter === b.letter) return "smooth";
  if (a.num === b.num && a.letter !== b.letter) return "smooth"; // relative
  const dist = ringDistance(a.num, b.num);
  if (a.letter === b.letter && dist === 1) return "smooth";
  if (a.letter === b.letter && dist === 2) return "workable";
  if (a.letter !== b.letter && dist <= 1) return "workable";
  return "abrupt";
}

/** Score BPM transition: ±3% smooth, ±6% workable, more = abrupt. */
export function scoreBpmTransition(fromBpm?: number | null, toBpm?: number | null): TransitionQuality | null {
  if (!fromBpm || !toBpm) return null;
  const pct = Math.abs(toBpm - fromBpm) / fromBpm;
  if (pct <= 0.03) return "smooth";
  if (pct <= 0.06) return "workable";
  return "abrupt";
}

/** Combine key + BPM scores: weakest link wins. */
export function combinedTransitionQuality(
  fromKey?: string | null,
  toKey?: string | null,
  fromBpm?: number | null,
  toBpm?: number | null,
): TransitionQuality {
  const k = scoreKeyTransition(fromKey, toKey);
  const b = scoreBpmTransition(fromBpm, toBpm);
  const order: TransitionQuality[] = ["smooth", "workable", "abrupt"];
  const scores = [k, b].filter(Boolean) as TransitionQuality[];
  if (scores.length === 0) return "workable";
  return scores.reduce((worst, s) => (order.indexOf(s) > order.indexOf(worst) ? s : worst), "smooth" as TransitionQuality);
}

/** Color per Camelot number for node rings. */
export function camelotColor(key?: string | null): string {
  const p = parseKey(key);
  if (!p) return "oklch(0.7 0.02 60)";
  // Spread hue around the wheel; A = slightly desaturated, B = brighter
  const hue = ((p.num - 1) * 30) % 360;
  const chroma = p.letter === "B" ? 0.15 : 0.1;
  return `oklch(0.72 ${chroma} ${hue})`;
}
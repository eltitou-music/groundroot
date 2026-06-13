import { scoreKeyTransition } from "@/lib/camelot";
import type { ArcShape } from "@/utils/companion-lines";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * Automix — the companion PROPOSES an order, with a one-line why.
 * It never persists anything itself: the caller previews the proposal and
 * the DJ keeps it or puts it back (hands off the art).
 */

const DESCENT_WORDS = [
  "comedown",
  "afters",
  "after-hours",
  "sunset",
  "dawn",
  "close",
  "closing",
  "wind down",
  "winddown",
  "slow morning",
  "ambient",
  "sleep",
  "rain",
];
const WAVE_WORDS = [
  "journey",
  "story",
  "wave",
  "dinner",
  "brunch",
  "road trip",
  "roadtrip",
  "session",
  "jazz",
  "flow",
];

export function arcShapeFor(intention: string | null): ArcShape {
  const s = (intention ?? "").toLowerCase();
  if (DESCENT_WORDS.some((w) => s.includes(w))) return "descent";
  if (WAVE_WORDS.some((w) => s.includes(w))) return "wave";
  return "ramp"; // warmup → peak: the classic, and the safe default
}

/** A track's energy proxy: energy if known, else BPM, else its current slot. */
function energyOf(t: MirroredTrack, fallbackIndex: number): number {
  if (t.energy !== null && t.energy !== undefined) return t.energy;
  if (t.bpm) return t.bpm; // BPM is a fair stand-in on a 0–200-ish scale
  return fallbackIndex; // keep crate order when we know nothing
}

/** Shape an ascending list into the arc. */
function applyShape(sortedAsc: MirroredTrack[], shape: ArcShape): MirroredTrack[] {
  if (shape === "ramp") return sortedAsc;
  if (shape === "descent") return [...sortedAsc].reverse();
  // wave: rise to a peak ~two-thirds in, then ease off.
  const rise: MirroredTrack[] = [];
  const fall: MirroredTrack[] = [];
  sortedAsc.forEach((t, i) => {
    if (i % 3 === 2) fall.unshift(t);
    else rise.push(t);
  });
  return [...rise, ...fall];
}

/**
 * One gentle harmonic pass: swap adjacent tracks when their energies are
 * close and the swap improves the key relationship. The arc stays intact;
 * the seams get smoother.
 */
function harmonicPass(order: MirroredTrack[]): MirroredTrack[] {
  const out = [...order];
  const qualityScore = (a: MirroredTrack, b: MirroredTrack): number => {
    const q = scoreKeyTransition(a.camelot_key, b.camelot_key);
    return q === "smooth" ? 2 : q === "workable" ? 1 : q === null ? 1 : 0;
  };
  for (let i = 0; i < out.length - 1; i++) {
    const a = out[i];
    const b = out[i + 1];
    const ea = energyOf(a, i);
    const eb = energyOf(b, i + 1);
    if (Math.abs(ea - eb) > 8) continue; // don't bend the arc for harmony
    const before =
      (i > 0 ? qualityScore(out[i - 1], a) : 0) +
      qualityScore(a, b) +
      (i + 2 < out.length ? qualityScore(b, out[i + 2]) : 0);
    const after =
      (i > 0 ? qualityScore(out[i - 1], b) : 0) +
      qualityScore(b, a) +
      (i + 2 < out.length ? qualityScore(a, out[i + 2]) : 0);
    if (after > before) {
      out[i] = b;
      out[i + 1] = a;
    }
  }
  return out;
}

export type AutomixProposal = {
  shape: ArcShape;
  order: MirroredTrack[];
  changed: boolean;
};

export function proposeOrder(tracks: MirroredTrack[], intention: string | null): AutomixProposal {
  const shape = arcShapeFor(intention);
  const sortedAsc = [...tracks].sort(
    (a, b) => energyOf(a, tracks.indexOf(a)) - energyOf(b, tracks.indexOf(b)),
  );
  const order = harmonicPass(applyShape(sortedAsc, shape));
  const changed = order.some((t, i) => t.id !== tracks[i]?.id);
  return { shape, order, changed };
}

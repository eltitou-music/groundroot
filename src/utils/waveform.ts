import { hashString } from "@/lib/utils";

/**
 * Waveform bar data for the lanes, set list, and dig cards.
 *
 * Deterministic from a seed (title) so every render of the same track shows
 * the same shape instantly — no decode needed for the visual. (Real peak
 * extraction from an AudioBuffer can refine these later, but the lane view
 * is decorative and must paint immediately.)
 */
export function waveformBars(seed: string, count = 48): number[] {
  const h = hashString(seed || "untitled");
  const bars: number[] = [];
  // Two interfering pseudo-random sine series → a believable, varied envelope.
  for (let i = 0; i < count; i++) {
    const a = Math.sin(i * (0.6 + (h % 7) * 0.05) + (h % 13));
    const b = Math.sin(i * (0.21 + ((h >> 3) % 5) * 0.03) + ((h >> 5) % 11));
    const n = ((hashString(`${seed}:${i}`) % 1000) / 1000) * 0.4;
    const v = (Math.abs(a) * 0.55 + Math.abs(b) * 0.3 + n) / 1.25;
    bars.push(Math.max(0.08, Math.min(1, v)));
  }
  return bars;
}

/** Real peaks from a decoded buffer (mono-summed), `count` buckets, 0..1. */
export function peaksFromBuffer(buf: AudioBuffer, count = 48): number[] {
  const ch = buf.getChannelData(0);
  const block = Math.floor(ch.length / count) || 1;
  const out: number[] = [];
  let max = 0.0001;
  for (let i = 0; i < count; i++) {
    let peak = 0;
    const start = i * block;
    for (let j = 0; j < block; j++) {
      const v = Math.abs(ch[start + j] || 0);
      if (v > peak) peak = v;
    }
    out.push(peak);
    if (peak > max) max = peak;
  }
  return out.map((v) => Math.max(0.06, v / max));
}

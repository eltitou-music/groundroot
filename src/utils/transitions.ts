/**
 * Per-boundary transition settings for Time. To. Play. — intentional moves,
 * not just crossfades. Shared by the mixer (drives the real audio fade) and
 * the booth export (cue points / notes). Persisted per set in localStorage so
 * the demo survives refresh without a migration.
 */

export type TransitionType = "overlay" | "cut" | "gap";
export type TransitionPreset = "auto" | "fondu" | "rise" | "blend" | "wave";

export type TransitionSetting = {
  length: number; // seconds
  type: TransitionType;
  preset: TransitionPreset;
  volume: string; // e.g. "Smooth crossfade"
  eq: string; // e.g. "Mid bass swap"
  filter: string; // e.g. "None"
};

export const PRESETS: {
  id: TransitionPreset;
  label: string;
  length: number;
  volume: string;
  eq: string;
  filter: string;
  note: string;
}[] = [
  {
    id: "auto",
    label: "Auto",
    length: 6,
    volume: "Smooth crossfade",
    eq: "Mid bass swap",
    filter: "None",
    note: "let the companion pick from key + tempo",
  },
  {
    id: "fondu",
    label: "Fondu",
    length: 8,
    volume: "Smooth crossfade",
    eq: "Mid bass swap",
    filter: "None",
    note: "long, melting blend",
  },
  {
    id: "rise",
    label: "Rise",
    length: 4,
    volume: "Equal power",
    eq: "Low cut in",
    filter: "High-pass sweep",
    note: "lift the incoming over the top",
  },
  {
    id: "blend",
    label: "Blend",
    length: 6,
    volume: "Smooth crossfade",
    eq: "Mid bass swap",
    filter: "None",
    note: "classic bass-swap overlap",
  },
  {
    id: "wave",
    label: "Wave",
    length: 10,
    volume: "Equal power",
    eq: "Tonal trade",
    filter: "Wash",
    note: "tension then release",
  },
];

export function defaultTransition(): TransitionSetting {
  const p = PRESETS[0];
  return {
    length: p.length,
    type: "overlay",
    preset: p.id,
    volume: p.volume,
    eq: p.eq,
    filter: p.filter,
  };
}

export function applyPreset(s: TransitionSetting, preset: TransitionPreset): TransitionSetting {
  const p = PRESETS.find((x) => x.id === preset) ?? PRESETS[0];
  return { ...s, preset, length: p.length, volume: p.volume, eq: p.eq, filter: p.filter };
}

/** What the audio engine actually uses for the crossfade duration. */
export function effectiveFade(s: TransitionSetting): number {
  if (s.type === "cut") return 0.12;
  if (s.type === "gap") return 0.12; // a clean break (visual gap; audio = quick cut)
  return Math.max(0.5, s.length);
}

const KEY = (setId: string) => `gr.transitions.${setId}`;

export function loadTransitions(setId: string, boundaries: number): TransitionSetting[] {
  let saved: TransitionSetting[] = [];
  try {
    const raw = localStorage.getItem(KEY(setId));
    if (raw) saved = JSON.parse(raw) as TransitionSetting[];
  } catch {
    /* ignore */
  }
  const out: TransitionSetting[] = [];
  for (let i = 0; i < boundaries; i++) out.push(saved[i] ?? defaultTransition());
  return out;
}

export function saveTransitions(setId: string, arr: TransitionSetting[]): void {
  try {
    localStorage.setItem(KEY(setId), JSON.stringify(arr));
  } catch {
    /* quota / private mode */
  }
}

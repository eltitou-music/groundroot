/**
 * Offline mirror — the demo must survive hotel wifi going down.
 *
 * Every successful set/tracks read on the flow screens is mirrored to
 * localStorage. Reads are wrapped in `withMirror`: if the network call
 * throws or takes longer than TIMEOUT_MS, we hydrate from the mirror and
 * the breath continues. Writes degrade to fire-and-forget — local state is
 * the source of truth for the session, Supabase catches up when it can.
 */

const TIMEOUT_MS = 4000;
const KEY_PREFIX = "gr.mirror.";

export type MirroredTrack = {
  id: string;
  set_id: string;
  position: number;
  title: string;
  artist: string | null;
  upload_url: string | null;
  duration: number | null;
  bpm: number | null;
  camelot_key: string | null;
  energy: number | null;
  cue_in: number | null;
  cue_out: number | null;
  notes: string | null;
  source: string;
};

export type MirroredSet = {
  id: string;
  title: string;
  intention: string | null;
  dedicated_to: string | null;
  cover_image_url: string | null;
};

export type SetMirror = {
  set: MirroredSet;
  tracks: MirroredTrack[];
  updatedAt: string;
};

export function saveMirror(setId: string, set: MirroredSet, tracks: MirroredTrack[]): void {
  try {
    const payload: SetMirror = { set, tracks, updatedAt: new Date().toISOString() };
    localStorage.setItem(KEY_PREFIX + setId, JSON.stringify(payload));
    localStorage.setItem(KEY_PREFIX + "latest", setId);
  } catch {
    // quota or private mode — mirror is best-effort
  }
}

export function loadMirror(setId: string): SetMirror | null {
  try {
    const raw = localStorage.getItem(KEY_PREFIX + setId);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as SetMirror;
    if (!parsed?.set?.id || !Array.isArray(parsed.tracks)) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** The set id of the most recently mirrored set, if any — offline re-entry point. */
export function latestMirroredSetId(): string | null {
  try {
    return localStorage.getItem(KEY_PREFIX + "latest");
  } catch {
    return null;
  }
}

/**
 * Race a network read against a timeout; fall back to `fallback` on
 * failure. Returns `{ data, offline }` so callers can mark degraded mode.
 */
export async function withTimeout<T>(
  fn: () => Promise<T>,
  fallback: () => T | null,
  timeoutMs = TIMEOUT_MS,
): Promise<{ data: T | null; offline: boolean }> {
  try {
    const data = await Promise.race([
      fn(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("gr-timeout")), timeoutMs),
      ),
    ]);
    return { data, offline: false };
  } catch {
    return { data: fallback(), offline: true };
  }
}

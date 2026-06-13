import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/utils/telemetry";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * The curated rights-free demo crate, served same-origin from
 * /demo-crate/ so it works with the wifi down. Metadata (bpm/key/energy)
 * is hand-authored in the manifest so S2 always has full data.
 */

export type DemoCrateTrack = {
  file: string;
  fallbackFile?: string;
  title: string;
  artist: string;
  bpm: number;
  camelot_key: string;
  energy: number;
  license: string;
};

let cached: DemoCrateTrack[] | null = null;

export async function loadDemoCrate(): Promise<DemoCrateTrack[]> {
  if (cached) return cached;
  const res = await fetch("/demo-crate/manifest.json");
  if (!res.ok) throw new Error("demo crate manifest missing");
  const json = (await res.json()) as { tracks: DemoCrateTrack[] };
  cached = json.tracks;
  return cached;
}

/** Resolve the playable same-origin URL for a crate track (mp3 preferred, wav placeholder fallback). */
export async function resolveCrateUrl(t: DemoCrateTrack): Promise<string> {
  const primary = `/demo-crate/${t.file}`;
  try {
    const head = await fetch(primary, { method: "HEAD" });
    if (head.ok) return primary;
  } catch {
    /* fall through */
  }
  return t.fallbackFile ? `/demo-crate/${t.fallbackFile}` : primary;
}

/**
 * Insert the full crate into a set. Tries Supabase first so the tracks
 * persist across devices; falls back to local-only rows (the flow context
 * mirrors them) when offline. Returns the tracks in mirror shape.
 */
export async function addCrateToSet(
  setId: string,
  basePosition: number,
  crate: DemoCrateTrack[],
): Promise<{ tracks: MirroredTrack[]; offline: boolean }> {
  const resolved = await Promise.all(crate.map((t) => resolveCrateUrl(t)));

  const rows = crate.map((t, i) => ({
    set_id: setId,
    source: "manual" as const,
    title: t.title,
    artist: t.artist,
    upload_url: resolved[i],
    bpm: t.bpm,
    camelot_key: t.camelot_key,
    energy: t.energy,
    position: basePosition + i,
  }));

  try {
    const { data, error } = await supabase.from("tracks").insert(rows).select("*");
    if (error) throw error;
    logEvent("demo_crate_added", { count: rows.length }, setId);
    return {
      offline: false,
      tracks: (data ?? []).map((r, i) => ({
        id: r.id,
        set_id: setId,
        position: r.position,
        title: r.title,
        artist: r.artist,
        upload_url: r.upload_url,
        duration: null,
        bpm: crate[i]?.bpm ?? null,
        camelot_key: crate[i]?.camelot_key ?? null,
        energy: crate[i]?.energy ?? null,
        cue_in: null,
        cue_out: null,
        notes: null,
        source: "manual",
      })),
    };
  } catch {
    // Offline: local-only rows; ids are synthetic, playback uses same-origin URLs.
    logEvent("demo_crate_added", { count: rows.length, offline: true }, setId);
    return {
      offline: true,
      tracks: rows.map((r, i) => ({
        id: `local-crate-${Date.now()}-${i}`,
        set_id: setId,
        position: r.position,
        title: r.title,
        artist: r.artist,
        upload_url: r.upload_url,
        duration: null,
        bpm: r.bpm,
        camelot_key: r.camelot_key,
        energy: r.energy,
        cue_in: null,
        cue_out: null,
        notes: null,
        source: "manual",
      })),
    };
  }
}

import { loadDemoCrate, resolveCrateUrl } from "@/utils/demo-crate";
import { supabase } from "@/integrations/supabase/client";
import { logEvent } from "@/utils/telemetry";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * Built-in sound sources for "Shall we dig?". Songs and sounds (hi-hats,
 * 808s, drops, textures, field recs, acapellas) are searched live on
 * archive.org; a small bundled crate is the offline fallback so the dig
 * screen always has something to browse. No BPM/key shown — browse by feel.
 */

export type SoundType =
  | "track"
  | "loop"
  | "one-shot"
  | "texture"
  | "field-rec"
  | "acapella"
  | "riser";

export type DigSource = "library" | "online" | "archives";

export type SoundResult = {
  id: string; // stable id for selection (identifier or local)
  title: string;
  artist: string; // creator / source label
  source: string; // "Free archive · archive.org", "Your library", etc.
  type: SoundType;
  durationLabel?: string;
  identifier?: string; // archive.org item id (resolve file on add)
  url?: string; // already-playable url (bundled fallback)
  bpm?: number | null;
  camelot_key?: string | null;
  energy?: number | null;
};

/** Quick category chips → archive.org query seeds. */
export const SOUND_CATEGORIES: { label: string; type: SoundType; query: string }[] = [
  { label: "Hi-hats", type: "one-shot", query: "hi hat drum one shot" },
  { label: "808s", type: "one-shot", query: "808 bass one shot" },
  { label: "Drops", type: "riser", query: "riser drop sweep fx" },
  { label: "Textures", type: "texture", query: "ambient texture drone" },
  { label: "Field recs", type: "field-rec", query: "field recording" },
  { label: "Acapellas", type: "acapella", query: "acapella vocal" },
];

const TYPE_QUERY: Record<SoundType, string> = {
  track: "",
  loop: "loop",
  "one-shot": "one shot",
  texture: "ambient texture",
  "field-rec": "field recording",
  acapella: "acapella vocal",
  riser: "riser sweep fx",
};

function withTimeout(url: string, ms = 6000): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, rej) => setTimeout(() => rej(new Error("timeout")), ms)),
  ]);
}

function creatorLabel(creator: unknown): string {
  if (Array.isArray(creator)) return String(creator[0] ?? "archive.org");
  if (typeof creator === "string" && creator.trim()) return creator;
  return "archive.org";
}

/** Search archive.org for audio matching the query + type. Returns [] on failure. */
export async function searchArchive(query: string, type: SoundType): Promise<SoundResult[]> {
  const terms = [query.trim(), TYPE_QUERY[type]].filter(Boolean).join(" ");
  const q = `(${terms || "music"}) AND mediatype:(audio)`;
  const url =
    `https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}` +
    `&fl[]=identifier&fl[]=title&fl[]=creator&rows=24&page=1&output=json`;
  try {
    const res = await withTimeout(url);
    if (!res.ok) return [];
    const json = (await res.json()) as {
      response?: { docs?: { identifier: string; title?: string; creator?: unknown }[] };
    };
    const docs = json.response?.docs ?? [];
    return docs
      .filter((d) => d.identifier && d.title)
      .map((d) => ({
        id: d.identifier,
        identifier: d.identifier,
        title: String(d.title),
        artist: creatorLabel(d.creator),
        source: "Free archive · archive.org",
        type,
      }));
  } catch {
    return [];
  }
}

/** Resolve a playable file URL for an archive.org item (first audio file). */
export async function resolveArchiveFile(identifier: string): Promise<string | null> {
  try {
    const res = await withTimeout(`https://archive.org/metadata/${encodeURIComponent(identifier)}`);
    if (!res.ok) return null;
    const json = (await res.json()) as { files?: { name: string; format?: string }[] };
    const files = json.files ?? [];
    const pref = ["VBR MP3", "MP3", "Ogg Vorbis", "Flac", "WAVE", "24bit Flac"];
    const pick =
      files.find((f) => pref.some((p) => (f.format ?? "").includes(p))) ||
      files.find((f) => /\.(mp3|ogg|oga|flac|wav)$/i.test(f.name));
    if (!pick) return null;
    return `https://archive.org/download/${encodeURIComponent(identifier)}/${encodeURIComponent(pick.name)}`;
  } catch {
    return null;
  }
}

/**
 * Add a dig result to the set. Resolves the playable URL (archive.org file
 * lookup if needed), inserts a track row, and returns it in mirror shape.
 * Falls back to a local-only row so the dig never dead-ends.
 */
export async function addSoundToSet(
  setId: string,
  position: number,
  sound: SoundResult,
): Promise<MirroredTrack | null> {
  let url = sound.url ?? null;
  if (!url && sound.identifier) url = await resolveArchiveFile(sound.identifier);
  if (!url) return null;

  const base: MirroredTrack = {
    id: `local-sound-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    set_id: setId,
    position,
    title: sound.title,
    artist: sound.artist,
    upload_url: url,
    duration: null,
    bpm: sound.bpm ?? null,
    camelot_key: sound.camelot_key ?? null,
    energy: sound.energy ?? null,
    cue_in: null,
    cue_out: null,
    notes: sound.type !== "track" ? sound.type : null,
    source: "manual",
  };
  try {
    const { data, error } = await supabase
      .from("tracks")
      .insert({
        set_id: setId,
        source: "manual",
        title: sound.title,
        artist: sound.artist,
        upload_url: url,
        bpm: sound.bpm ?? null,
        camelot_key: sound.camelot_key ?? null,
        energy: sound.energy ?? null,
        notes: base.notes,
        position,
      })
      .select("id")
      .single();
    if (error) throw error;
    logEvent("sound_added", { type: sound.type, source: sound.source }, setId);
    return { ...base, id: data.id };
  } catch {
    logEvent("sound_added", { type: sound.type, source: sound.source, offline: true }, setId);
    return base;
  }
}

/** Bundled, offline-safe crate (the rights-free demo tracks) as dig cards. */
export async function bundledSounds(): Promise<SoundResult[]> {
  try {
    const crate = await loadDemoCrate();
    const urls = await Promise.all(crate.map((t) => resolveCrateUrl(t)));
    return crate.map((t, i) => ({
      id: `bundled-${t.file}`,
      title: t.title,
      artist: t.artist,
      source: "Demo crate",
      type: "track" as SoundType,
      url: urls[i],
      bpm: t.bpm,
      camelot_key: t.camelot_key,
      energy: t.energy,
    }));
  } catch {
    return [];
  }
}

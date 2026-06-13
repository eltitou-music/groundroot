import { supabase } from "@/integrations/supabase/client";
import { ensureUserId } from "@/utils/today-set";
import { logEvent } from "@/utils/telemetry";
import type { MirroredTrack } from "@/utils/set-mirror";

/**
 * Shared audio import — used by the Start drop area and the Dig dropzone.
 * Uploads to Supabase storage when possible; falls back to an in-memory
 * object URL when offline so the breath always continues. Accepts tracks,
 * stems, voice notes — any common audio.
 */

export const MAX_BYTES = 60 * 1024 * 1024; // generous: stems/voice notes welcome
export const MAX_TRACKS_PER_SET = 16;

const ACCEPTED_EXT = [
  "mp3",
  "wav",
  "m4a",
  "aac",
  "ogg",
  "oga",
  "flac",
  "aif",
  "aiff",
  "webm",
] as const;
export const ACCEPT_ATTR = ".mp3,.wav,.m4a,.aac,.ogg,.oga,.flac,.aif,.aiff,.webm,audio/*";

const SIGNED_URL_TTL = 60 * 60 * 24 * 365 * 10;

export function extOf(name: string): string {
  const m = name.toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

export function isAcceptedAudio(file: File): boolean {
  const ext = extOf(file.name);
  if (ACCEPTED_EXT.includes(ext as (typeof ACCEPTED_EXT)[number])) return true;
  return file.type.startsWith("audio/");
}

function slugify(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9.]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "track"
  );
}

export function cleanTitle(filename: string): { title: string; artist: string | null } {
  const noExt = filename.replace(/\.[^/.]+$/, "");
  const cleaned = noExt.replace(/[_]+/g, " ").replace(/\s+/g, " ").trim();
  const dash = cleaned.split(/\s+-\s+/);
  if (dash.length >= 2 && dash[0].length >= 2 && dash[1].length >= 2) {
    return { artist: dash[0].trim(), title: dash.slice(1).join(" - ").trim() };
  }
  return { artist: null, title: cleaned.replace(/-+/g, " ").replace(/\s+/g, " ").trim() };
}

function contentTypeFor(file: File): string {
  if (file.type) return file.type;
  const ext = extOf(file.name);
  return ext === "mp3"
    ? "audio/mpeg"
    : ext === "wav" || ext === "aif" || ext === "aiff"
      ? "audio/wav"
      : ext === "flac"
        ? "audio/flac"
        : ext === "ogg" || ext === "oga"
          ? "audio/ogg"
          : "audio/mp4";
}

/**
 * Upload one audio file into a set. Returns the new track in mirror shape.
 * Never throws — on any failure it returns a local object-URL track so the
 * file still plays this session.
 */
export async function uploadAudioFile(
  setId: string,
  file: File,
  position: number,
): Promise<MirroredTrack> {
  const { title, artist } = cleanTitle(file.name);
  const local = (): MirroredTrack => ({
    id: `local-upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    set_id: setId,
    position,
    title,
    artist,
    upload_url: URL.createObjectURL(file),
    duration: null,
    bpm: null,
    camelot_key: null,
    energy: null,
    cue_in: null,
    cue_out: null,
    notes: null,
    source: "upload",
  });

  const started = performance.now();
  try {
    const uid = await ensureUserId();
    const path = `${uid}/${setId}/${Date.now()}-${slugify(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from("track-uploads")
      .upload(path, file, { contentType: contentTypeFor(file), upsert: false });
    if (upErr) throw upErr;
    const { data: signed, error: signErr } = await supabase.storage
      .from("track-uploads")
      .createSignedUrl(path, SIGNED_URL_TTL);
    if (signErr || !signed?.signedUrl) throw signErr ?? new Error("no signed url");
    const { data: row, error: insErr } = await supabase
      .from("tracks")
      .insert({
        set_id: setId,
        source: "upload",
        title,
        artist,
        upload_url: signed.signedUrl,
        position,
      })
      .select("id, title, artist, upload_url, position")
      .single();
    if (insErr) throw insErr;
    logEvent(
      "upload_succeeded",
      { ms: Math.round(performance.now() - started), size: file.size },
      setId,
    );
    return {
      id: row.id,
      set_id: setId,
      position: row.position,
      title: row.title,
      artist: row.artist,
      upload_url: row.upload_url,
      duration: null,
      bpm: null,
      camelot_key: null,
      energy: null,
      cue_in: null,
      cue_out: null,
      notes: null,
      source: "upload",
    };
  } catch (e) {
    logEvent(
      "upload_succeeded",
      { offline: true, reason: e instanceof Error ? e.message : "unknown", size: file.size },
      setId,
    );
    return local();
  }
}

/** Filter a FileList to accepted audio, with a reject reason per dropped file. */
export function partitionAudio(files: File[]): {
  accepted: File[];
  rejected: { file: File; reason: string }[];
} {
  const accepted: File[] = [];
  const rejected: { file: File; reason: string }[] = [];
  for (const f of files) {
    if (!isAcceptedAudio(f)) rejected.push({ file: f, reason: "not audio" });
    else if (f.size > MAX_BYTES) rejected.push({ file: f, reason: "over 60 MB" });
    else accepted.push(f);
  }
  return { accepted, rejected };
}

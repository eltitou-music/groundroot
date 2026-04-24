import { supabase } from "@/integrations/supabase/client";

/**
 * Shared hand-off helper — used by Beatmaker, Library, Assembly entry points.
 * Gets-or-creates an anonymous session + a "current" set carrying the user's
 * intention, then optionally appends a track to it.
 *
 * Returns the set id so callers can navigate to /assembly/$setId.
 */
export type HandoffTrack = {
  title: string;
  artist?: string | null;
  source: "spotify" | "drive" | "upload" | "manual";
  notes?: string | null;
  upload_url?: string | null;
  bpm?: number | null;
};

async function ensureUserId(): Promise<string> {
  const { data: sess } = await supabase.auth.getSession();
  let uid = sess.session?.user.id ?? null;
  if (!uid) {
    const { data, error } = await supabase.auth.signInAnonymously();
    if (error) throw error;
    uid = data.user?.id ?? null;
  }
  if (!uid) throw new Error("Couldn't start a session.");
  return uid;
}

/** Find the most recent set for the user, or create a new one with this intention. */
async function ensureSet(uid: string, intention: string | undefined): Promise<string> {
  const { data: existing } = await supabase
    .from("sets")
    .select("id")
    .eq("user_id", uid)
    .order("updated_at", { ascending: false })
    .limit(1);

  if (existing && existing.length > 0) return existing[0].id;

  const { data: created, error } = await supabase
    .from("sets")
    .insert({
      user_id: uid,
      title: "Untitled set",
      intention: intention?.trim() || null,
    })
    .select()
    .single();
  if (error) throw error;
  return created.id;
}

/** Append a track to a set; returns nothing — fire-and-forget. */
async function appendTrack(setId: string, track: HandoffTrack): Promise<void> {
  // Position = current count, so it lands at the end of the arrangement.
  const { count } = await supabase
    .from("tracks")
    .select("*", { count: "exact", head: true })
    .eq("set_id", setId);

  const { error } = await supabase.from("tracks").insert({
    set_id: setId,
    title: track.title,
    artist: track.artist ?? null,
    source: track.source,
    notes: track.notes ?? null,
    upload_url: track.upload_url ?? null,
    bpm: track.bpm ?? null,
    position: count ?? 0,
  });
  if (error) throw error;
}

/** One-shot: ensure session + set, append the track, return the set id. */
export async function handoffToAssembly(
  intention: string | undefined,
  track: HandoffTrack,
): Promise<string> {
  const uid = await ensureUserId();
  const setId = await ensureSet(uid, intention);
  await appendTrack(setId, track);
  return setId;
}
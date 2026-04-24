import { supabase } from "@/integrations/supabase/client";

/**
 * Patient-zero usage pattern: open the app and continue today's work.
 * If a set was touched in the last 24h, return it. Otherwise create one.
 */
export async function ensureUserId(): Promise<string> {
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

export type TodaySet = {
  id: string;
  intention: string | null;
  dedicated_to: string | null;
  title: string;
  isFresh: boolean; // true when newly created in this call
};

export async function findTodaySet(uid: string): Promise<TodaySet | null> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from("sets")
    .select("id, intention, dedicated_to, title, updated_at")
    .eq("user_id", uid)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  if (!data || data.length === 0) return null;
  const row = data[0];
  return {
    id: row.id,
    intention: row.intention,
    dedicated_to: row.dedicated_to,
    title: row.title,
    isFresh: false,
  };
}

export async function getOrCreateTodaySet(
  uid: string,
  intention: string | undefined,
  dedicatedTo: string | undefined,
): Promise<TodaySet> {
  const existing = await findTodaySet(uid);
  if (existing) return existing;

  const { data, error } = await supabase
    .from("sets")
    .insert({
      user_id: uid,
      title: "Untitled set",
      intention: intention?.trim() || null,
      dedicated_to: dedicatedTo?.trim() || null,
    })
    .select("id, intention, dedicated_to, title")
    .single();
  if (error) throw error;
  return {
    id: data.id,
    intention: data.intention,
    dedicated_to: data.dedicated_to,
    title: data.title,
    isFresh: true,
  };
}
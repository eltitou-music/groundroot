/**
 * Shared helpers around the persisted coach conversation stored in
 * `sets.coach_state`. The conversation is considered "live" only for a
 * configurable window after its last update — once it expires we stop
 * showing the resume banner on /welcome and the unread dot on the
 * Home button.
 */

export type Pillar = "beatmaker" | "library" | "assembly" | "mastering";

export type StoredCoachState = {
  messages?: unknown[];
  lastPillar?: Pillar | null;
  lastSection?: string | null;
  updatedAt?: string;
} | null;

/**
 * How long a saved coach conversation stays "fresh" before it is hidden
 * from the resume UI. Tweak in one place.
 */
export const COACH_STATE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * True when the stored conversation has at least one message AND its
 * own `updatedAt` (or, as a fallback, the row's `updated_at`) is within
 * COACH_STATE_TTL_MS.
 */
export function isCoachStateFresh(
  state: StoredCoachState,
  rowUpdatedAt?: string | null,
  now: number = Date.now(),
): boolean {
  if (!state || !Array.isArray(state.messages) || state.messages.length === 0) {
    return false;
  }
  const stamp = state.updatedAt ?? rowUpdatedAt ?? null;
  if (!stamp) return false;
  const t = Date.parse(stamp);
  if (Number.isNaN(t)) return false;
  return now - t < COACH_STATE_TTL_MS;
}

/**
 * ISO timestamp of the cutoff before which any coach conversation is
 * considered stale. Useful for narrowing a Supabase `.gte("updated_at", …)`
 * query so we don't fetch obviously-expired rows.
 */
export function coachStaleCutoffIso(now: number = Date.now()): string {
  return new Date(now - COACH_STATE_TTL_MS).toISOString();
}
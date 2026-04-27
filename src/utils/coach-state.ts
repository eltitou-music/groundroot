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
 * Default expiry window for a saved coach conversation. Used when the
 * user has not picked their own value in settings.
 */
export const COACH_STATE_DEFAULT_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

/** Hard bounds for any user-chosen TTL, to keep the UI sensible. */
export const COACH_STATE_MIN_TTL_MS = 5 * 60 * 1000;             // 5 minutes
export const COACH_STATE_MAX_TTL_MS = 30 * 24 * 60 * 60 * 1000;  // 30 days

const TTL_STORAGE_KEY = "groundroot.coachStateTtlMs";

/** Preset windows surfaced in the settings UI. */
export const COACH_TTL_PRESETS: { label: string; ms: number }[] = [
  { label: "1 hour",  ms: 60 * 60 * 1000 },
  { label: "6 hours", ms: 6 * 60 * 60 * 1000 },
  { label: "12 hours", ms: 12 * 60 * 60 * 1000 },
  { label: "1 day",   ms: 24 * 60 * 60 * 1000 },
  { label: "3 days",  ms: 3 * 24 * 60 * 60 * 1000 },
  { label: "7 days",  ms: 7 * 24 * 60 * 60 * 1000 },
];

function clampTtl(ms: number): number {
  if (!Number.isFinite(ms) || ms <= 0) return COACH_STATE_DEFAULT_TTL_MS;
  return Math.min(COACH_STATE_MAX_TTL_MS, Math.max(COACH_STATE_MIN_TTL_MS, ms));
}

/**
 * Returns the user's preferred TTL window (ms), falling back to the
 * default. Safe to call in SSR — returns the default when `window` is
 * unavailable.
 */
export function getCoachStateTtlMs(): number {
  if (typeof window === "undefined") return COACH_STATE_DEFAULT_TTL_MS;
  try {
    const raw = window.localStorage.getItem(TTL_STORAGE_KEY);
    if (!raw) return COACH_STATE_DEFAULT_TTL_MS;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) return COACH_STATE_DEFAULT_TTL_MS;
    return clampTtl(n);
  } catch {
    return COACH_STATE_DEFAULT_TTL_MS;
  }
}

/**
 * Persist a new TTL window. Emits a same-tab `storage`-style event so
 * mounted components can react without a reload.
 */
export function setCoachStateTtlMs(ms: number): number {
  const clamped = clampTtl(ms);
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(TTL_STORAGE_KEY, String(clamped));
      window.dispatchEvent(
        new CustomEvent("groundroot:coach-ttl-changed", { detail: clamped }),
      );
    } catch {
      /* ignore */
    }
  }
  return clamped;
}

/**
 * Human-readable rendering of a TTL window (e.g. "12 hours", "3 days").
 */
export function formatTtl(ms: number): string {
  const preset = COACH_TTL_PRESETS.find((p) => p.ms === ms);
  if (preset) return preset.label;
  const minutes = Math.round(ms / (60 * 1000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(ms / (60 * 60 * 1000));
  if (hours < 48) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.round(ms / (24 * 60 * 60 * 1000));
  return `${days} day${days === 1 ? "" : "s"}`;
}

/**
 * True when the stored conversation has at least one message AND its
 * own `updatedAt` (or, as a fallback, the row's `updated_at`) is within
 * the user's configured TTL.
 */
export function isCoachStateFresh(
  state: StoredCoachState,
  rowUpdatedAt?: string | null,
  now: number = Date.now(),
  ttlMs: number = getCoachStateTtlMs(),
): boolean {
  if (!state || !Array.isArray(state.messages) || state.messages.length === 0) {
    return false;
  }
  const stamp = state.updatedAt ?? rowUpdatedAt ?? null;
  if (!stamp) return false;
  const t = Date.parse(stamp);
  if (Number.isNaN(t)) return false;
  return now - t < ttlMs;
}

/**
 * ISO timestamp of the cutoff before which any coach conversation is
 * considered stale. Useful for narrowing a Supabase `.gte("updated_at", …)`
 * query so we don't fetch obviously-expired rows.
 */
export function coachStaleCutoffIso(
  now: number = Date.now(),
  ttlMs: number = getCoachStateTtlMs(),
): string {
  return new Date(now - ttlMs).toISOString();
}
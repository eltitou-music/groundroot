import { createContext, useContext } from "react";
import type { MirroredSet, MirroredTrack } from "@/utils/set-mirror";

/**
 * Shared state for the S0→S5 breath. The layout route loads the set once
 * (network with offline-mirror fallback) and every stage reads/writes
 * through this context so local state stays the source of truth.
 */
export type FlowContextValue = {
  setRow: MirroredSet;
  tracks: MirroredTrack[];
  /** true when we're running from the localStorage mirror (wifi down). */
  offline: boolean;
  /** Re-pull set + tracks from the network (falls back to mirror). */
  refresh: () => Promise<void>;
  /** Optimistic set update — local immediately, Supabase fire-and-forget. */
  updateSet: (patch: Partial<Omit<MirroredSet, "id">>) => void;
  /** Replace the local track list (mirror + state); optionally persist positions. */
  setTracksLocal: (tracks: MirroredTrack[]) => void;
  /** Append a locally-created track (offline upload / demo crate fallback). */
  addLocalTrack: (track: MirroredTrack) => void;
  /** Remove a track locally (and fire-and-forget remotely). */
  removeTrack: (trackId: string) => void;
};

export const FlowContext = createContext<FlowContextValue | null>(null);

export function useFlow(): FlowContextValue {
  const v = useContext(FlowContext);
  if (!v) throw new Error("useFlow must be used inside the /set/$setId layout");
  return v;
}

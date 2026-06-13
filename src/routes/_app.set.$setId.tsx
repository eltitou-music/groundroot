import { useCallback, useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { FlowContext, type FlowContextValue } from "@/components/flow/flow-context";
import { BreathShell, type StageKey } from "@/components/flow/BreathShell";
import {
  loadMirror,
  saveMirror,
  withTimeout,
  type MirroredSet,
  type MirroredTrack,
} from "@/utils/set-mirror";

export const Route = createFileRoute("/_app/set/$setId")({
  component: FlowLayout,
});

/** Map a Supabase tracks row to the mirror shape (numbers normalised). */
function toMirroredTrack(r: Record<string, unknown>): MirroredTrack {
  const num = (v: unknown): number | null =>
    v === null || v === undefined || v === "" ? null : Number(v);
  return {
    id: String(r.id),
    set_id: String(r.set_id),
    position: Number(r.position ?? 0),
    title: String(r.title ?? "Untitled"),
    artist: (r.artist as string | null) ?? null,
    upload_url: (r.upload_url as string | null) ?? null,
    duration: num(r.duration),
    bpm: num(r.bpm),
    camelot_key: (r.camelot_key as string | null) ?? null,
    energy: num(r.energy),
    cue_in: num(r.cue_in),
    cue_out: num(r.cue_out),
    notes: (r.notes as string | null) ?? null,
    source: String(r.source ?? "manual"),
  };
}

function FlowLayout() {
  const { setId } = Route.useParams();
  const { pathname } = useLocation();
  const [setRow, setSetRow] = useState<MirroredSet | null>(null);
  const [tracks, setTracks] = useState<MirroredTrack[]>([]);
  const [offline, setOffline] = useState(false);
  const [loading, setLoading] = useState(true);
  const [missing, setMissing] = useState(false);

  const stage: StageKey = useMemo(() => {
    if (pathname.endsWith("/order")) return "order";
    if (pathname.endsWith("/play")) return "play";
    if (pathname.endsWith("/polish")) return "polish";
    if (pathname.endsWith("/door")) return "door";
    return "dig";
  }, [pathname]);

  const fetchAll = useCallback(async () => {
    const { data: offData, offline: wentOffline } = await withTimeout(
      async () => {
        const [setRes, trackRes] = await Promise.all([
          supabase
            .from("sets")
            .select("id, title, intention, dedicated_to, cover_image_url")
            .eq("id", setId)
            .single(),
          supabase
            .from("tracks")
            .select("*")
            .eq("set_id", setId)
            .order("position", { ascending: true }),
        ]);
        if (setRes.error) throw setRes.error;
        if (trackRes.error) throw trackRes.error;
        return {
          set: setRes.data as MirroredSet,
          tracks: (trackRes.data ?? []).map((r) => toMirroredTrack(r as Record<string, unknown>)),
        };
      },
      () => {
        const mirror = loadMirror(setId);
        return mirror ? { set: mirror.set, tracks: mirror.tracks } : null;
      },
    );

    if (!offData) {
      setMissing(true);
      setLoading(false);
      return;
    }
    setSetRow(offData.set);
    setTracks(offData.tracks);
    setOffline(wentOffline);
    if (!wentOffline) saveMirror(setId, offData.set, offData.tracks);
    setLoading(false);
  }, [setId]);

  useEffect(() => {
    void fetchAll();
  }, [fetchAll]);

  const updateSet = useCallback<FlowContextValue["updateSet"]>(
    (patch) => {
      setSetRow((prev) => {
        if (!prev) return prev;
        const next = { ...prev, ...patch };
        saveMirror(setId, next, tracks);
        return next;
      });
      // Fire-and-forget; local state is the session's source of truth.
      void supabase
        .from("sets")
        .update(patch)
        .eq("id", setId)
        .then(({ error }) => {
          if (error) console.warn("[flow] set update deferred", error.message);
        });
    },
    [setId, tracks],
  );

  const setTracksLocal = useCallback<FlowContextValue["setTracksLocal"]>(
    (next) => {
      setTracks(next);
      setSetRow((prev) => {
        if (prev) saveMirror(setId, prev, next);
        return prev;
      });
    },
    [setId],
  );

  const addLocalTrack = useCallback<FlowContextValue["addLocalTrack"]>(
    (track) => {
      setTracks((prev) => {
        const next = [...prev, track].sort((a, b) => a.position - b.position);
        setSetRow((s) => {
          if (s) saveMirror(setId, s, next);
          return s;
        });
        return next;
      });
    },
    [setId],
  );

  const removeTrack = useCallback<FlowContextValue["removeTrack"]>(
    (trackId) => {
      setTracks((prev) => {
        const next = prev.filter((t) => t.id !== trackId);
        setSetRow((s) => {
          if (s) saveMirror(setId, s, next);
          return s;
        });
        return next;
      });
      void supabase
        .from("tracks")
        .delete()
        .eq("id", trackId)
        .then(({ error }) => {
          if (error) console.warn("[flow] track delete deferred", error.message);
        });
    },
    [setId],
  );

  if (loading) {
    return (
      <div className="flex h-[60vh] items-center justify-center text-sm italic text-muted-foreground">
        finding your set…
      </div>
    );
  }

  if (missing || !setRow) {
    return (
      <div className="flex h-[60vh] flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-muted-foreground">This set doesn't exist or isn't yours.</p>
        <Link to="/welcome" className="text-sm text-warm-link underline-offset-4 hover:underline">
          Take a fresh breath →
        </Link>
      </div>
    );
  }

  const ctx: FlowContextValue = {
    setRow,
    tracks,
    offline,
    refresh: fetchAll,
    updateSet,
    setTracksLocal,
    addLocalTrack,
    removeTrack,
  };

  return (
    <FlowContext.Provider value={ctx}>
      <BreathShell stage={stage}>
        <Outlet />
      </BreathShell>
    </FlowContext.Provider>
  );
}

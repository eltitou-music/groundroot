import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFlow } from "@/components/flow/flow-context";
import { StageCta, StageBack } from "@/components/flow/BreathShell";
import { LivePlayer, type PlayerSnapshot } from "@/utils/live-player";
import { combinedTransitionQuality } from "@/lib/camelot";
import { transitionLine } from "@/utils/companion-lines";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/set/$setId/play")({
  component: PlayPage,
});

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * S3 — Time to playyy.
 * One continuous blended set, ONE progress bar for the whole thing (never
 * per-track), a single now-playing caption, and the companion's quiet line
 * at each blend. The set is one thing.
 */
function PlayPage() {
  const { setRow, tracks } = useFlow();
  const playerRef = useRef<LivePlayer | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot>({
    playing: false,
    elapsed: 0,
    total: 0,
    currentIndex: 0,
    ready: false,
    ended: false,
  });
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const playedLogged = useRef(false);
  const microTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const playable = tracks.filter((t) => !!t.upload_url);

  // Build the player once per track-list identity.
  useEffect(() => {
    if (playable.length === 0) return;
    const player = new LivePlayer(
      playable.map((t) => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        url: t.upload_url!,
      })),
      {
        onSnapshot: setSnap,
        onStall: () => {
          setStalled(true);
          logEvent("playback_stalled", { i: playerRef.current ? 1 : 0 }, setRow.id);
          setTimeout(() => setStalled(false), 2500);
        },
        onTransition: (from, to) => {
          const a = playable[from];
          const b = playable[to];
          if (!a || !b) return;
          const quality = combinedTransitionQuality(a.camelot_key, b.camelot_key, a.bpm, b.bpm);
          const line = transitionLine(quality, `${a.id}->${b.id}`);
          setMicrocopy(line);
          logEvent("transition_reached", { from, to, quality }, setRow.id);
          if (microTimer.current) clearTimeout(microTimer.current);
          microTimer.current = setTimeout(() => setMicrocopy(null), 4500);
        },
        onEnded: () => {
          setMicrocopy(null);
        },
        onError: (m) => console.warn("[play]", m),
      },
    );
    playerRef.current = player;
    void player.load();
    return () => {
      player.dispose();
      playerRef.current = null;
      if (microTimer.current) clearTimeout(microTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable.map((t) => t.id).join(","), setRow.id]);

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (snap.playing) {
      p.pause();
    } else {
      if (!playedLogged.current) {
        playedLogged.current = true;
        logEvent("set_played", { tracks: playable.length }, setRow.id);
      }
      void p.play();
    }
  }, [snap.playing, playable.length, setRow.id]);

  const current = playable[snap.currentIndex];
  const pct = snap.total > 0 ? Math.min(100, (snap.elapsed / snap.total) * 100) : 0;

  if (playable.length < 2) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm italic text-muted-foreground">
          a set needs at least two tracks to blend.
        </p>
        <StageBack to="dig" setId={setRow.id} label="back to the dig" />
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <p className="mt-2 text-center text-sm italic text-muted-foreground">
        one set, one breath. press play and just listen.
      </p>

      {/* Now playing — a single caption, never a per-track list */}
      <div className="mt-12 flex flex-col items-center text-center">
        <AnimatePresence mode="wait">
          <motion.div
            key={current?.id ?? "none"}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.6 }}
          >
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/60">
              {snap.ended ? "that's the set" : "now"}
            </p>
            <p className="mt-1 font-display text-2xl text-foreground">{current?.title ?? "—"}</p>
            {current?.artist && <p className="text-sm text-muted-foreground">{current.artist}</p>}
          </motion.div>
        </AnimatePresence>

        {/* The companion's quiet line at a blend */}
        <div className="mt-4 h-6">
          <AnimatePresence>
            {microcopy && (
              <motion.p
                key={microcopy}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-sm italic text-warm-link"
              >
                {microcopy}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* ONE progress bar for the whole set */}
      <div className="mt-10 w-full max-w-lg">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary/60">
          <motion.div
            className="h-full rounded-full bg-warm-link"
            style={{ width: `${pct}%` }}
            transition={{ ease: "linear" }}
          />
        </div>
        <div className="mt-1.5 flex justify-between text-[11px] font-mono text-muted-foreground/60">
          <span>{fmt(snap.elapsed)}</span>
          <span>{snap.ready ? fmt(snap.total) : "…"}</span>
        </div>
      </div>

      {/* Play / Pause — one big calm action */}
      <button
        type="button"
        onClick={toggle}
        disabled={!snap.ready}
        aria-label={snap.playing ? "Pause" : "Play"}
        className={cn(
          "mt-8 flex h-16 w-16 items-center justify-center rounded-full bg-warm-link/15 text-warm-link transition-all",
          "hover:bg-warm-link/25 hover:shadow-[0_0_30px_-4px_rgba(212,165,116,0.6)]",
          !snap.ready && "opacity-40",
        )}
      >
        {!snap.ready ? (
          <Loader2 className="h-6 w-6 animate-spin" />
        ) : snap.playing ? (
          <Pause className="h-6 w-6" />
        ) : (
          <Play className="ml-1 h-6 w-6" />
        )}
      </button>

      <div className="mt-2 h-4">
        {stalled && (
          <p className="text-[11px] italic text-muted-foreground/70">buffering — hang on…</p>
        )}
      </div>

      <div className="flex-1" />

      <StageCta to="polish" setId={setRow.id} hint="when it sounds right">
        Sounds right → polish it
      </StageCta>
      <StageBack to="order" setId={setRow.id} label="back to the order" />
    </div>
  );
}

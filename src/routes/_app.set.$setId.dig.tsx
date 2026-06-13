import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Music, X } from "lucide-react";
import { useFlow } from "@/components/flow/flow-context";
import { TrackDrop, MAX_TRACKS_PER_SET } from "@/components/flow/TrackDrop";
import { DemoCrate } from "@/components/flow/DemoCrate";
import { StageCta } from "@/components/flow/BreathShell";
import { gradientFor } from "@/lib/utils";
import { logEvent } from "@/utils/telemetry";

export const Route = createFileRoute("/_app/set/$setId/dig")({
  component: DigPage,
});

/**
 * S1 — Shall we dig?
 * Bring-your-own tracks + the demo crate. Feel-first design law:
 * NO BPM, NO key, anywhere on this screen. Covers and names only.
 */
function DigPage() {
  const { setRow, tracks, addLocalTrack, removeTrack } = useFlow();

  return (
    <div className="flex flex-1 flex-col">
      <p className="mt-2 text-center text-sm italic text-muted-foreground">
        the tracks you already love are enough.
      </p>

      <div className="mt-8">
        <TrackDrop setId={setRow.id} trackCount={tracks.length} onAdded={addLocalTrack} />
        <DemoCrate
          setId={setRow.id}
          trackCount={tracks.length}
          existingTitles={tracks.map((t) => t.title)}
          onAdded={(ts) => ts.forEach(addLocalTrack)}
        />
      </div>

      {tracks.length > 0 && (
        <div className="mt-8">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="font-display text-lg text-foreground">In the crate</h2>
            <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground/70">
              {tracks.length}/{MAX_TRACKS_PER_SET}
            </span>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            <AnimatePresence initial={false}>
              {tracks.map((t) => (
                <motion.li
                  key={t.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  className="group flex items-center gap-3 rounded-2xl border border-border/50 bg-card/40 p-3 backdrop-blur-sm"
                >
                  <div
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white/85"
                    style={{ background: gradientFor(t.title) }}
                    aria-hidden
                  >
                    <Music className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground" title={t.title}>
                      {t.title}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {t.artist ?? "Your track"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      removeTrack(t.id);
                      logEvent("track_removed", {}, setRow.id);
                    }}
                    aria-label={`Remove ${t.title}`}
                    title="Remove"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary/60 text-muted-foreground opacity-60 transition-all hover:bg-destructive/20 hover:text-destructive hover:opacity-100"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <div className="flex-1" />

      <StageCta
        to="order"
        setId={setRow.id}
        disabled={tracks.length < 2}
        hint={tracks.length < 2 ? "two tracks is all a blend needs — bring one more." : undefined}
      >
        These are the ones →
      </StageCta>
    </div>
  );
}

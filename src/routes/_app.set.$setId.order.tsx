import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Wand2, Undo2, Check, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useFlow } from "@/components/flow/flow-context";
import { SetList } from "@/components/flow/SetList";
import { StageCta, StageBack } from "@/components/flow/BreathShell";
import { proposeOrder } from "@/utils/automix";
import { automixWhy, type ArcShape } from "@/utils/companion-lines";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";
import type { MirroredTrack } from "@/utils/set-mirror";

export const Route = createFileRoute("/_app/set/$setId/order")({
  component: OrderPage,
});

/**
 * S2 — We need a clean up…
 * Drag to order by feel. Automix proposes (with a why) — the DJ keeps it or
 * puts it back. Numbers exist but stay hidden until asked for.
 */
function OrderPage() {
  const { setRow, tracks, setTracksLocal, removeTrack } = useFlow();
  const [showNumbers, setShowNumbers] = useState(false);
  const [order, setOrder] = useState<MirroredTrack[]>(tracks);
  const [proposal, setProposal] = useState<{ shape: ArcShape; snapshot: MirroredTrack[] } | null>(
    null,
  );
  const reorderLogged = useRef(false);

  // Keep local order in sync when tracks change elsewhere (add/remove).
  useEffect(() => {
    setOrder(tracks);
  }, [tracks]);

  /** Persist the current order: local mirror immediately, DB fire-and-forget. */
  const persistPositions = useCallback(
    (next: MirroredTrack[]) => {
      const renumbered = next.map((t, i) => ({ ...t, position: i }));
      setTracksLocal(renumbered);
      const remote = renumbered.filter((t) => !t.id.startsWith("local-"));
      if (remote.length === 0) return;
      void (async () => {
        try {
          // Two-phase write avoids position collisions mid-flight.
          await Promise.all(
            remote.map((t, i) =>
              supabase
                .from("tracks")
                .update({ position: -1000 - i })
                .eq("id", t.id),
            ),
          );
          await Promise.all(
            remote.map((t) =>
              supabase.from("tracks").update({ position: t.position }).eq("id", t.id),
            ),
          );
        } catch (e) {
          console.warn("[order] position sync deferred", e);
        }
      })();
    },
    [setTracksLocal],
  );

  const commitDrag = useCallback(() => {
    persistPositions(order);
    logEvent("tracks_reordered", { count: order.length, first: !reorderLogged.current }, setRow.id);
    reorderLogged.current = true;
  }, [order, persistPositions, setRow.id]);

  /* ----- Automix: propose, preview, keep or put back ----- */

  const propose = () => {
    const { shape, order: proposed, changed } = proposeOrder(order, setRow.intention);
    logEvent("automix_proposed", { shape, changed }, setRow.id);
    setProposal({ shape, snapshot: order });
    setOrder(proposed);
  };

  const keepProposal = () => {
    if (!proposal) return;
    persistPositions(order);
    logEvent("automix_accepted", { shape: proposal.shape }, setRow.id);
    setProposal(null);
  };

  const undoProposal = () => {
    if (!proposal) return;
    setOrder(proposal.snapshot);
    logEvent("automix_undone", { shape: proposal.shape }, setRow.id);
    setProposal(null);
  };

  /* ----- Lazy duration backfill (metadata only — cheap) ----- */
  useEffect(() => {
    let cancelled = false;
    const missing = tracks.filter((t) => !t.duration && t.upload_url);
    if (missing.length === 0) return;
    missing.forEach((t) => {
      const el = new Audio();
      el.preload = "metadata";
      el.src = t.upload_url!;
      el.addEventListener(
        "loadedmetadata",
        () => {
          if (cancelled || !Number.isFinite(el.duration) || el.duration <= 0) return;
          const dur = Math.round(el.duration * 10) / 10;
          setTracksLocal(
            tracks.map((x) => (x.id === t.id ? { ...x, duration: dur } : x)) as MirroredTrack[],
          );
          if (!t.id.startsWith("local-")) {
            void supabase.from("tracks").update({ duration_seconds: dur }).eq("id", t.id);
          }
        },
        { once: true },
      );
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tracks.map((t) => t.id).join(",")]);

  return (
    <div className="flex flex-1 flex-col">
      <p className="mt-2 text-center text-sm italic text-muted-foreground">
        order it by feel — your ears outrank the math.
      </p>

      {/* One row of quiet controls */}
      <div className="mt-7 flex items-center justify-between">
        <button
          type="button"
          onClick={propose}
          disabled={!!proposal || order.length < 3}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border border-warm-link/40 bg-warm-link/10 px-4 py-1.5 text-xs font-medium text-warm-link transition-all",
            "hover:bg-warm-link/20",
            (!!proposal || order.length < 3) && "opacity-40",
          )}
          title="The companion proposes an order — you decide."
        >
          <Wand2 className="h-3.5 w-3.5" />
          Propose an order
        </button>

        <button
          type="button"
          onClick={() => {
            const next = !showNumbers;
            setShowNumbers(next);
            logEvent("details_toggled", { on: next }, setRow.id);
          }}
          className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] uppercase tracking-[0.15em] text-muted-foreground/70 transition-colors hover:text-foreground"
        >
          {showNumbers ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          {showNumbers ? "Hide the numbers" : "Show the numbers"}
        </button>
      </div>

      {/* Automix preview banner */}
      <AnimatePresence>
        {proposal && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="mt-3 flex items-center justify-between gap-3 rounded-2xl border border-warm-link/40 bg-warm-link/10 px-4 py-3"
          >
            <p className="text-sm italic text-foreground/90">{automixWhy(proposal.shape)}</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={keepProposal}
                className="inline-flex items-center gap-1.5 rounded-full bg-warm-link/25 px-3 py-1 text-xs font-medium text-foreground transition-colors hover:bg-warm-link/40"
              >
                <Check className="h-3 w-3" />
                Keep this order
              </button>
              <button
                type="button"
                onClick={undoProposal}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1 text-xs text-foreground/85 transition-colors hover:border-warm-link"
              >
                <Undo2 className="h-3 w-3" />
                Put it back
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-5">
        <SetList
          tracks={order}
          showNumbers={showNumbers}
          onReorder={setOrder}
          onCommit={commitDrag}
          onRemove={removeTrack}
          disabled={!!proposal}
        />
      </div>

      <div className="flex-1" />

      <StageCta to="play" setId={setRow.id} disabled={order.length < 2 || !!proposal}>
        Sounds like a set → hear it
      </StageCta>
      <StageBack to="dig" setId={setRow.id} label="back to the dig" />
    </div>
  );
}

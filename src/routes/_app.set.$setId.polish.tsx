import { useCallback, useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Sparkles, Loader2, Wand2 } from "lucide-react";
import { useFlow } from "@/components/flow/flow-context";
import { StageBack } from "@/components/flow/BreathShell";
import { renderSetMasterBuffer, audioBufferToWav, type MasterSettings } from "@/utils/render";
import { publishMaster } from "@/utils/share";
import { putRender, setShareUrl } from "@/utils/render-cache";
import { SWATCHES, swatchToken, selectedSwatchId, coverGradient } from "@/utils/swatches";
import { celebrationLine, stallLine } from "@/utils/companion-lines";
import { logEvent } from "@/utils/telemetry";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_app/set/$setId/polish")({
  component: PolishPage,
});

/** The one fixed mastering preset — streaming-ready, no settings UI. */
const PRESET: MasterSettings = { lufs: -14, low: 1, mid: 0, high: 1, width: 55, glue: 45 };

type Phase = "setup" | "rendering" | "done";

/**
 * S4 — Gotta polish this gem.
 * Name it, give it a colour, press one button. The companion renders the
 * master (real progress, never silence) and lands on a quiet celebration.
 */
function PolishPage() {
  const { setRow, tracks, updateSet, offline } = useFlow();
  const navigate = useNavigate();
  const [name, setName] = useState(setRow.title === "Untitled set" ? "" : setRow.title);
  const [nameSaved, setNameSaved] = useState(false);
  const [phase, setPhase] = useState<Phase>("setup");
  const [progress, setProgress] = useState<string>("");
  const stallTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = selectedSwatchId(setRow.cover_image_url);
  const playable = tracks.filter((t) => !!t.upload_url).sort((a, b) => a.position - b.position);

  useEffect(() => {
    return () => {
      if (stallTimer.current) clearTimeout(stallTimer.current);
    };
  }, []);

  const saveName = () => {
    const title = name.trim() || "Untitled set";
    if (title !== setRow.title) updateSet({ title });
    setNameSaved(true);
    setTimeout(() => setNameSaved(false), 1400);
  };

  const pickSwatch = (id: string) => {
    updateSet({ cover_image_url: swatchToken(id) });
  };

  const polish = useCallback(async () => {
    if (phase === "rendering") return;
    setPhase("rendering");
    setProgress("Warming up the master bus…");

    // If a render takes a beat, the companion fills the silence.
    stallTimer.current = setTimeout(() => setProgress(stallLine(setRow.id)), 6000);

    try {
      const sources = playable.map((t) => ({ url: t.upload_url as string, title: t.title }));
      const buffer = await renderSetMasterBuffer(
        setRow.id,
        PRESET,
        (msg) => setProgress(msg),
        sources,
      );
      if (stallTimer.current) clearTimeout(stallTimer.current);
      if (!buffer) {
        setProgress("");
        setPhase("setup");
        return;
      }
      const wav = audioBufferToWav(buffer);
      putRender({ setId: setRow.id, buffer, wav, shareUrl: null });

      logEvent("set_polished", { tracks: playable.length, offline }, setRow.id);
      setPhase("done");

      // Publish in the background when online — the door works either way.
      if (!offline) {
        void publishMaster(setRow.id, wav)
          .then((res) => setShareUrl(setRow.id, res.shareUrl))
          .catch((e) => console.warn("[polish] publish deferred", e));
      }
    } catch (e) {
      if (stallTimer.current) clearTimeout(stallTimer.current);
      console.error("[polish] render failed", e);
      setProgress("That render hiccuped — give it another go.");
      setPhase("setup");
    }
  }, [phase, playable, setRow.id, offline]);

  const gradient = coverGradient(
    selected ? swatchToken(selected) : setRow.cover_image_url,
    name || setRow.title,
  );

  return (
    <div className="flex flex-1 flex-col items-center">
      <AnimatePresence mode="wait">
        {phase === "done" ? (
          <Celebration
            key="celebration"
            title={name || setRow.title}
            gradient={gradient}
            onContinue={() => navigate({ to: "/set/$setId/door", params: { setId: setRow.id } })}
          />
        ) : (
          <motion.div
            key="setup"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex w-full max-w-md flex-col items-center"
          >
            <p className="mt-2 text-center text-sm italic text-muted-foreground">
              give it a name and a colour. then one button finishes it.
            </p>

            {/* Cover preview */}
            <div
              className="mt-8 flex h-40 w-40 items-center justify-center rounded-3xl shadow-lg"
              style={{ background: gradient }}
            >
              <Sparkles className="h-8 w-8 text-white/70" />
            </div>

            {/* Name */}
            <div className="mt-6 w-full">
              <div className="flex items-center gap-2 rounded-full border border-border/60 bg-card/50 px-5 py-2 focus-within:border-warm-link">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={saveName}
                  onKeyDown={(e) => e.key === "Enter" && (e.currentTarget.blur(), saveName())}
                  maxLength={80}
                  placeholder="Name this set…"
                  className="w-full bg-transparent text-center text-base text-foreground placeholder:text-muted-foreground/50 focus:outline-none"
                />
                {nameSaved && <Check className="h-4 w-4 shrink-0 text-warm-link" />}
              </div>
            </div>

            {/* Swatches */}
            <div className="mt-5 flex items-center gap-3">
              {SWATCHES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSwatch(s.id)}
                  aria-label={s.label}
                  title={s.label}
                  className={cn(
                    "h-8 w-8 rounded-full transition-all",
                    selected === s.id
                      ? "ring-2 ring-warm-link ring-offset-2 ring-offset-background"
                      : "opacity-80 hover:opacity-100",
                  )}
                  style={{ background: s.gradient }}
                />
              ))}
            </div>

            {/* The one button */}
            <button
              type="button"
              onClick={() => void polish()}
              disabled={phase === "rendering" || playable.length < 2}
              className={cn(
                "mt-9 inline-flex items-center gap-2 rounded-full bg-warm-link/20 px-8 py-3.5 font-display text-lg text-warm-link transition-all",
                "hover:bg-warm-link/30 hover:shadow-[0_0_30px_-4px_rgba(212,165,116,0.6)]",
                (phase === "rendering" || playable.length < 2) && "opacity-50",
              )}
            >
              {phase === "rendering" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Wand2 className="h-5 w-5" />
              )}
              {phase === "rendering" ? "Polishing…" : "Polish"}
            </button>

            <div className="mt-3 h-5">
              {progress && (
                <p className="text-[12px] italic text-muted-foreground/80">{progress}</p>
              )}
            </div>

            <div className="flex-1" />
            <StageBack to="play" setId={setRow.id} label="back to the set" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Celebration({
  title,
  gradient,
  onContinue,
}: {
  title: string;
  gradient: string;
  onContinue: () => void;
}) {
  const [line] = useState(() => celebrationLine(title));
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative flex flex-col items-center"
    >
      {/* gentle particle burst */}
      {Array.from({ length: 14 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute left-1/2 top-20 h-1.5 w-1.5 rounded-full bg-warm-link"
          initial={{ opacity: 0.9, x: 0, y: 0 }}
          animate={{
            opacity: 0,
            x: Math.cos((i / 14) * Math.PI * 2) * 120,
            y: Math.sin((i / 14) * Math.PI * 2) * 120,
          }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        />
      ))}

      <div
        className="mt-10 flex h-44 w-44 items-center justify-center rounded-3xl shadow-2xl"
        style={{ background: gradient }}
      >
        <span className="px-4 text-center font-display text-lg text-white/90">{title}</span>
      </div>

      <p className="mt-8 font-display text-xl italic text-foreground">{line}</p>

      <button
        type="button"
        onClick={onContinue}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-warm-link/20 px-7 py-3 font-display text-base text-warm-link transition-all hover:bg-warm-link/30"
      >
        Take it to the door →
      </button>
    </motion.div>
  );
}

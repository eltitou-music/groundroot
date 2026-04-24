import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Play, Pause, RotateCcw, Plus, Minus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { zodValidator } from "@tanstack/zod-adapter";
import { intentionSearchSchema } from "@/utils/intention";

export const Route = createFileRoute("/_app/beatmaker")({
  validateSearch: zodValidator(intentionSearchSchema),
  head: () => ({
    meta: [
      { title: "Beatmaker — GroundRoot" },
      { name: "description", content: "Tap a cell, find the pocket. A calm sandbox for rhythm." },
      { property: "og:title", content: "Beatmaker — GroundRoot" },
      { property: "og:description", content: "Tap a cell, find the pocket. A calm sandbox for rhythm." },
    ],
  }),
  component: BeatmakerPage,
});

type Voice = { name: string; freq: number; type: OscillatorType; decay: number; color: string };

const VOICES: Voice[] = [
  { name: "Kick",  freq: 60,   type: "sine",     decay: 0.35, color: "oklch(0.68 0.17 50)" },
  { name: "Snare", freq: 220,  type: "triangle", decay: 0.18, color: "oklch(0.78 0.14 90)" },
  { name: "Hat",   freq: 8000, type: "square",   decay: 0.06, color: "oklch(0.55 0.1 145)" },
  { name: "Perc",  freq: 440,  type: "sawtooth", decay: 0.12, color: "oklch(0.72 0.14 60)" },
];

const STEPS = 16;

function BeatmakerPage() {
  const { intention } = Route.useSearch();
  const [pattern, setPattern] = useState<boolean[][]>(() =>
    VOICES.map((_, r) =>
      Array.from({ length: STEPS }, (_, c) =>
        (r === 0 && c % 4 === 0) || (r === 2 && c % 2 === 1),
      ),
    ),
  );
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(96);
  const [step, setStep] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);
  const timerRef = useRef<number | null>(null);
  const stepRef = useRef(0);
  const patternRef = useRef(pattern);
  patternRef.current = pattern;

  const ensureCtx = () => {
    if (!ctxRef.current) {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctxRef.current = new Ctor();
    }
    return ctxRef.current!;
  };

  const playVoice = (v: Voice) => {
    const ctx = ensureCtx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = v.type;
    o.frequency.setValueAtTime(v.freq, ctx.currentTime);
    if (v.name === "Kick") {
      o.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.15);
    }
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.005);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + v.decay);
    o.connect(g).connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + v.decay + 0.02);
  };

  useEffect(() => {
    if (!playing) {
      if (timerRef.current) window.clearInterval(timerRef.current);
      timerRef.current = null;
      return;
    }
    const interval = (60_000 / bpm) / 4; // 16th notes
    timerRef.current = window.setInterval(() => {
      const cur = stepRef.current;
      patternRef.current.forEach((row, r) => {
        if (row[cur]) playVoice(VOICES[r]);
      });
      setStep(cur);
      stepRef.current = (cur + 1) % STEPS;
    }, interval);
    return () => {
      if (timerRef.current) window.clearInterval(timerRef.current);
    };
  }, [playing, bpm]);

  const toggle = (r: number, c: number) => {
    setPattern((p) => p.map((row, ri) => (ri !== r ? row : row.map((v, ci) => (ci !== c ? v : !v)))));
  };

  const clear = () => setPattern(VOICES.map(() => Array(STEPS).fill(false)));

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-20 md:px-6">
      <div className="mx-auto w-full max-w-5xl">
        <Link
          to="/welcome"
          className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-warm-link/70 transition-opacity hover:opacity-100"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </Link>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className="font-display font-medium leading-[0.95] tracking-tight text-gradient-brand-radial"
          style={{ fontSize: "clamp(40px, 7vw, 84px)" }}
        >
          Beatmaker
        </motion.h1>

        {intention && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-2 text-xs uppercase tracking-[0.18em] text-warm-link/80"
          >
            from your intention · <span className="italic normal-case text-foreground/80">{intention}</span>
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15, ease: "easeOut" }}
          className="mt-4 max-w-xl text-base text-muted-foreground/80 md:text-lg"
        >
          a sandbox for rhythm — tap a cell, find the pocket.
        </motion.p>

        {/* Transport */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/40 p-3 backdrop-blur-sm"
        >
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>
          <button
            onClick={() => { setStep(0); stepRef.current = 0; clear(); }}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-warm-link hover:text-warm-link"
            aria-label="Clear pattern"
            title="Clear"
          >
            <RotateCcw className="h-4 w-4" />
          </button>

          <div className="ml-2 flex items-center gap-2">
            <button
              onClick={() => setBpm((b) => Math.max(40, b - 2))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-warm-link hover:text-warm-link"
              aria-label="Decrease BPM"
            >
              <Minus className="h-3 w-3" />
            </button>
            <div className="min-w-[80px] text-center font-mono text-sm tabular-nums text-foreground">
              {bpm} <span className="text-xs uppercase tracking-[0.2em] text-muted-foreground">bpm</span>
            </div>
            <button
              onClick={() => setBpm((b) => Math.min(220, b + 2))}
              className="flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground hover:border-warm-link hover:text-warm-link"
              aria-label="Increase BPM"
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>

          <div className="ml-auto text-xs uppercase tracking-[0.2em] text-muted-foreground">
            16 steps · 4 voices
          </div>
        </motion.div>

        {/* Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="mt-6 space-y-2"
        >
          {VOICES.map((v, r) => (
            <div key={v.name} className="flex items-center gap-3">
              <div className="flex w-20 shrink-0 items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: v.color }}
                />
                {v.name}
              </div>
              <div className="grid flex-1 grid-cols-16 gap-1.5" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
                {pattern[r].map((on, c) => {
                  const isBeat = c % 4 === 0;
                  const isCurrent = playing && step === c;
                  return (
                    <button
                      key={c}
                      onClick={() => toggle(r, c)}
                      className={cn(
                        "aspect-square rounded-md border transition-all",
                        on
                          ? "border-transparent shadow-[0_0_12px_-2px_oklch(0.84_0.14_90/0.4)]"
                          : "border-border/40 bg-card/30 hover:border-warm-link/50",
                        isCurrent && "ring-2 ring-warm-link/70 ring-offset-1 ring-offset-background",
                        isBeat && !on && "bg-card/50",
                      )}
                      style={on ? { background: v.color } : undefined}
                      aria-label={`${v.name} step ${c + 1}`}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </motion.div>

        <p className="mt-6 text-xs italic text-muted-foreground/70">
          A first draft. Sample chopping, swing, and saving patterns are next.
        </p>
      </div>
    </div>
  );
}

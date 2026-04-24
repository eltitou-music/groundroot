import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Play, Pause, RotateCcw, Plus, Minus, Shuffle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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

/* ---------------- Voices (body words, not drum-machine words) ---------------- */

type Voice = {
  name: string;
  hint: string;
  freq: number;
  type: OscillatorType;
  decay: number;
  color: string;
  // Optional pitch envelope target — used so each voice has a distinct body
  pitchTo?: number;
};

const VOICES: Voice[] = [
  { name: "Heart",   hint: "the kick — low, steady, your pulse",      freq: 60,   type: "sine",     decay: 0.38, color: "oklch(0.62 0.18 30)",  pitchTo: 38  },
  { name: "Clap",    hint: "the snare — body, hands together",         freq: 200,  type: "triangle", decay: 0.20, color: "oklch(0.78 0.14 90)" },
  { name: "Whisper", hint: "the hat — air, breath, top end",           freq: 8200, type: "square",   decay: 0.05, color: "oklch(0.55 0.1 145)" },
  { name: "Spark",   hint: "the perc — ornament, accents",              freq: 520,  type: "sawtooth", decay: 0.10, color: "oklch(0.72 0.14 60)" },
  { name: "Bloom",   hint: "the bass — wide and warm beneath",          freq: 110,  type: "sine",     decay: 0.45, color: "oklch(0.55 0.13 150)", pitchTo: 90 },
  { name: "Pulse",   hint: "the lead — a melodic blip",                 freq: 660,  type: "triangle", decay: 0.18, color: "oklch(0.84 0.16 90)",  pitchTo: 880 },
];

const STEPS = 32;

/* ---------------- Style seeds (max 10) ---------------- */

type Style = {
  id: string;
  label: string;
  emoji: string;
  bpm: number;
  // 6 rows × 32 cols of booleans, but expressed compactly as step indices per voice
  pattern: number[][];
};

// Helpers to keep style definitions readable.
const every = (mod: number, offset = 0) =>
  Array.from({ length: STEPS }, (_, i) => i).filter((i) => i % mod === offset);
const at = (...n: number[]) => n;

const STYLES: Style[] = [
  {
    id: "house",
    label: "House",
    emoji: "🏠",
    bpm: 122,
    pattern: [
      every(4),                       // Heart  — four-on-the-floor
      every(8, 4),                    // Clap   — backbeat (every other 4)
      every(2, 1),                    // Whisper— offbeat hat
      at(6, 14, 22, 30),              // Spark  — ghost perc
      [],                             // Bloom
      [],                             // Pulse
    ],
  },
  {
    id: "techno",
    label: "Techno",
    emoji: "🌑",
    bpm: 132,
    pattern: [
      every(4),                       // Heart
      [],                             // Clap (sparser in techno)
      every(2, 1),                    // Whisper offbeat
      at(7, 15, 23, 31),              // Spark
      every(8, 2),                    // Bloom — sub stab
      [],                             // Pulse
    ],
  },
  {
    id: "hiphop",
    label: "Hip-Hop",
    emoji: "🎤",
    bpm: 90,
    pattern: [
      at(0, 6, 16, 22),               // Heart  — boom-bap
      at(8, 24),                      // Clap   — backbeat on 2/4
      every(2),                       // Whisper
      at(11, 27),                     // Spark
      [],                             // Bloom
      [],                             // Pulse
    ],
  },
  {
    id: "rnb",
    label: "R&B",
    emoji: "💎",
    bpm: 85,
    pattern: [
      at(0, 10, 16, 26),              // Heart  — laid-back
      at(8, 24),                      // Clap
      every(4, 2),                    // Whisper — soft
      at(13, 29),                     // Spark
      at(0, 16),                      // Bloom — 808 anchor
      [],                             // Pulse
    ],
  },
  {
    id: "jazz",
    label: "Jazz",
    emoji: "🎷",
    bpm: 110,
    pattern: [
      at(0, 14, 16, 30),              // Heart — soft, syncopated
      at(8, 24),                      // Clap (rim/snare on 2/4)
      [0, 2, 5, 8, 10, 13, 16, 18, 21, 24, 26, 29], // Whisper — ride pattern
      at(6, 22),                      // Spark
      [],                             // Bloom
      at(4, 12, 20, 28),              // Pulse — comping accents
    ],
  },
  {
    id: "electronic",
    label: "Electronic",
    emoji: "⚡",
    bpm: 124,
    pattern: [
      every(4),                       // Heart
      every(8, 4),                    // Clap
      every(2, 1),                    // Whisper
      at(3, 11, 19, 27),              // Spark
      [],                             // Bloom
      at(0, 10, 16, 26),              // Pulse
    ],
  },
  {
    id: "afro",
    label: "Afro",
    emoji: "🌍",
    bpm: 116,
    pattern: [
      at(0, 6, 10, 16, 22, 26),       // Heart — afro-house pulse
      at(4, 20),                      // Clap
      [0, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30], // Whisper — shaker
      at(2, 12, 18, 28),              // Spark — congas
      at(0, 16),                      // Bloom
      [],                             // Pulse
    ],
  },
  {
    id: "disco",
    label: "Disco",
    emoji: "🪩",
    bpm: 118,
    pattern: [
      every(4),                       // Heart
      every(8, 4),                    // Clap
      every(2, 1),                    // Whisper — open hat offbeat
      at(2, 6, 10, 14, 18, 22, 26, 30), // Spark — 16th tambourine
      every(8),                       // Bloom — bass on the one
      [],                             // Pulse
    ],
  },
  {
    id: "ambient",
    label: "Ambient",
    emoji: "🌫️",
    bpm: 72,
    pattern: [
      [],                             // Heart — none
      [],                             // Clap
      at(7, 23),                      // Whisper — sparse
      at(0, 24),                      // Spark — single hits
      at(0),                          // Bloom — drone
      at(8, 20),                      // Pulse — melodic punctuation
    ],
  },
];

function BeatmakerPage() {
  const { intention } = Route.useSearch();
  const [styleId, setStyleId] = useState<string>(STYLES[0].id);
  const [pattern, setPattern] = useState<boolean[][]>(() => stylePattern(STYLES[0]));
  const [playing, setPlaying] = useState(false);
  const [bpm, setBpm] = useState(STYLES[0].bpm);
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
    if (v.pitchTo) {
      o.frequency.exponentialRampToValueAtTime(v.pitchTo, ctx.currentTime + Math.min(0.18, v.decay * 0.5));
    }
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.55, ctx.currentTime + 0.005);
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

  const applyStyle = (s: Style) => {
    setStyleId(s.id);
    setBpm(s.bpm);
    setPattern(stylePattern(s));
    setStep(0);
    stepRef.current = 0;
  };

  const reseed = () => {
    const s = STYLES.find((x) => x.id === styleId) ?? STYLES[0];
    setPattern(stylePattern(s, /* jitter */ true));
  };

  const gridTemplate = useMemo(
    () => ({ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }),
    [],
  );

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-20 md:px-6">
      <div className="mx-auto w-full max-w-6xl">
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
          a sandbox for rhythm — pick a feel, then tap to find the pocket.
        </motion.p>

        {/* Style selector */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8"
        >
          <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground/80">A feel to start from</p>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((s) => {
              const active = s.id === styleId;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => applyStyle(s)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs backdrop-blur-sm transition-all",
                    active
                      ? "border-warm-link bg-warm-link/15 text-foreground"
                      : "border-border/60 bg-card/40 text-muted-foreground hover:border-warm-link/60 hover:text-foreground",
                  )}
                  title={`${s.label} · ${s.bpm} bpm`}
                >
                  <span aria-hidden className="text-sm leading-none">{s.emoji}</span>
                  <span>{s.label}</span>
                </button>
              );
            })}
          </div>
        </motion.div>

        {/* Transport */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-6 flex flex-wrap items-center gap-3 rounded-2xl border border-border/40 bg-card/40 p-3 backdrop-blur-sm"
        >
          <button
            onClick={() => setPlaying((p) => !p)}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
          </button>
          <button
            onClick={reseed}
            className="flex h-11 w-11 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition-colors hover:border-warm-link hover:text-warm-link"
            aria-label="Reseed pattern"
            title="Reseed (shuffle this style)"
          >
            <Shuffle className="h-4 w-4" />
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
            {STEPS} steps · {VOICES.length} voices
          </div>
        </motion.div>

        {/* Grid */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.45 }}
          className="mt-6 space-y-2 overflow-x-auto pb-2"
        >
          {VOICES.map((v, r) => (
            <div key={v.name} className="flex items-center gap-3 min-w-[640px]">
              <div
                className="flex w-24 shrink-0 flex-col gap-0.5 text-xs uppercase tracking-[0.18em] text-muted-foreground"
                title={v.hint}
              >
                <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: v.color }}
                />
                <span className="text-foreground/90">{v.name}</span>
                </div>
                <span className="ml-[18px] text-[9px] normal-case tracking-normal text-muted-foreground/60">
                  {v.hint.split(" — ")[0]}
                </span>
              </div>
              <div className="grid flex-1 gap-1" style={gridTemplate}>
                {pattern[r].map((on, c) => {
                  const isBeat = c % 4 === 0;
                  const isBar = c % 8 === 0;
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
                        isBar && !on && "bg-card/70",
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
          Sketches save themselves quietly in the background. Hand-offs to Library and Assembly are coming next.
        </p>
      </div>
    </div>
  );
}

/* ---------------- helpers ---------------- */

function stylePattern(s: Style, jitter = false): boolean[][] {
  return s.pattern.map((row) => {
    const arr = Array(STEPS).fill(false) as boolean[];
    row.forEach((i) => {
      if (i >= 0 && i < STEPS) arr[i] = true;
    });
    if (jitter) {
      // 10% of OFF cells get turned on, 5% of ON cells get dropped — keeps the feel, adds surprise
      for (let i = 0; i < STEPS; i++) {
        if (!arr[i] && Math.random() < 0.08) arr[i] = true;
        else if (arr[i] && Math.random() < 0.05) arr[i] = false;
      }
    }
    return arr;
  });
}

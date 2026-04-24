import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Download, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { zodValidator } from "@tanstack/zod-adapter";
import { intentionSearchSchema } from "@/utils/intention";

export const Route = createFileRoute("/_app/mastering")({
  validateSearch: zodValidator(intentionSearchSchema),
  head: () => ({
    meta: [
      { title: "Mastery — GroundRoot" },
      { name: "description", content: "The final pass — level, glue, and translate your set so it lands the same everywhere." },
      { property: "og:title", content: "Mastery — GroundRoot" },
      { property: "og:description", content: "Polish a finished set for release." },
    ],
  }),
  component: MasteringPage,
});

const PRESETS = [
  { name: "Club soundsystem", lufs: -8,  low: 2,  mid: 0,  high: 1,  width: 60, glue: 65 },
  { name: "Streaming (DSP)",  lufs: -14, low: 0,  mid: 0,  high: 0,  width: 50, glue: 40 },
  { name: "Headphones",       lufs: -16, low: -1, mid: 1,  high: 2,  width: 55, glue: 30 },
  { name: "Car stereo",       lufs: -12, low: 3,  mid: -1, high: 2,  width: 45, glue: 50 },
] as const;

function MasteringPage() {
  const { intention } = Route.useSearch();
  const [lufs, setLufs] = useState(-14);
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);
  const [width, setWidth] = useState(50);
  const [glue, setGlue] = useState(40);
  const [activePreset, setActivePreset] = useState<string | null>("Streaming (DSP)");

  const applyPreset = (p: (typeof PRESETS)[number]) => {
    setLufs(p.lufs); setLow(p.low); setMid(p.mid); setHigh(p.high);
    setWidth(p.width); setGlue(p.glue);
    setActivePreset(p.name);
  };

  // Fake "meter" derived from current settings
  const meter = useMemo(() => {
    const norm = Math.max(0, Math.min(1, (lufs + 24) / 24)); // -24..0 -> 0..1
    const peak = Math.min(1, norm + 0.08);
    const safe = lufs <= -9;
    return { norm, peak, safe };
  }, [lufs]);

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-20 md:px-6">
      <div className="mx-auto w-full max-w-4xl">
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
          Mastery
        </motion.h1>

        {intention && (
          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-warm-link/80">
            from your intention · <span className="italic normal-case text-foreground/80">{intention}</span>
          </p>
        )}

        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="mt-4 max-w-xl text-base text-muted-foreground/80 md:text-lg"
        >
          the final pass — level, glue, and translate your set so it lands the same everywhere.
        </motion.p>

        {/* Presets */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10"
        >
          <p className="mb-3 text-xs uppercase tracking-[0.2em] text-muted-foreground">Translate to</p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <button
                key={p.name}
                onClick={() => applyPreset(p)}
                className={cn(
                  "rounded-full border px-4 py-2 text-xs backdrop-blur-sm transition-all",
                  activePreset === p.name
                    ? "border-warm-link bg-warm-link/15 text-foreground"
                    : "border-border/60 bg-card/40 text-muted-foreground hover:border-warm-link/60 hover:text-foreground",
                )}
              >
                {p.name}
              </button>
            ))}
          </div>
        </motion.div>

        <div className="mt-8 grid gap-6 md:grid-cols-[1fr_280px]">
          {/* Controls */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="rounded-2xl border border-border/40 bg-card/40 p-6 backdrop-blur-sm"
          >
            <ControlRow
              label="Loudness target"
              value={`${lufs} LUFS`}
              min={-24}
              max={-6}
              step={0.5}
              v={lufs}
              onChange={(n) => { setLufs(n); setActivePreset(null); }}
            />
            <Divider />
            <p className="mb-4 text-[10px] uppercase tracking-[0.22em] text-warm-link/70">3-band EQ</p>
            <ControlRow label="Low"  value={fmtDb(low)}  min={-6} max={6} step={0.5} v={low}  onChange={(n) => { setLow(n); setActivePreset(null); }} />
            <ControlRow label="Mid"  value={fmtDb(mid)}  min={-6} max={6} step={0.5} v={mid}  onChange={(n) => { setMid(n); setActivePreset(null); }} />
            <ControlRow label="High" value={fmtDb(high)} min={-6} max={6} step={0.5} v={high} onChange={(n) => { setHigh(n); setActivePreset(null); }} />
            <Divider />
            <ControlRow label="Stereo width" value={`${width}%`} min={0} max={100} step={1} v={width} onChange={(n) => { setWidth(n); setActivePreset(null); }} />
            <ControlRow label="Bus glue"     value={`${glue}%`}  min={0} max={100} step={1} v={glue}  onChange={(n) => { setGlue(n); setActivePreset(null); }} />
          </motion.div>

          {/* Meter + export */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="flex flex-col gap-4"
          >
            <div className="rounded-2xl border border-border/40 bg-card/40 p-5 backdrop-blur-sm">
              <p className="mb-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Output meter</p>
              <div className="relative h-40 overflow-hidden rounded-lg bg-background/60">
                <div
                  className="absolute inset-x-2 bottom-2 rounded-md transition-[height] duration-300"
                  style={{
                    height: `${meter.norm * 100}%`,
                    background: "linear-gradient(180deg, oklch(0.84 0.14 90) 0%, oklch(0.68 0.17 50) 60%, oklch(0.55 0.2 30) 100%)",
                    opacity: 0.85,
                  }}
                />
                {/* Peak line */}
                <div
                  className="absolute inset-x-2 h-px bg-foreground/70"
                  style={{ bottom: `calc(${meter.peak * 100}% + 0.5rem)` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                <span className="font-mono tabular-nums text-foreground">{lufs} LUFS</span>
                <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]", meter.safe ? "bg-primary-soft text-accent-foreground" : "bg-destructive/20 text-destructive")}>
                  {meter.safe ? "Safe" : "Hot"}
                </span>
              </div>
            </div>

            <div className="rounded-2xl border border-warm-link/40 bg-warm-link/10 p-5 backdrop-blur-sm">
              <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-warm-link">
                <Sparkles className="h-3.5 w-3.5" />
                Export
              </div>
              <p className="text-xs text-muted-foreground">
                WAV 24-bit · 44.1 kHz · normalized to your target.
              </p>
              <button
                disabled
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-warm-link/30 px-4 py-2.5 text-xs uppercase tracking-[0.18em] text-warm-link opacity-70"
                title="Available once Assembly is finished"
              >
                <Download className="h-3.5 w-3.5" />
                Render master
              </button>
            </div>
          </motion.div>
        </div>

        <p className="mt-6 text-xs italic text-muted-foreground/70">
          A first draft. Real DSP, EQ matching against reference tracks, and one-click export are next.
        </p>
      </div>
    </div>
  );
}

function ControlRow({
  label, value, min, max, step, v, onChange,
}: {
  label: string; value: string; min: number; max: number; step: number;
  v: number; onChange: (n: number) => void;
}) {
  return (
    <div className="mb-4 last:mb-0">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
        <span className="font-mono text-xs tabular-nums text-foreground">{value}</span>
      </div>
      <Slider value={[v]} min={min} max={max} step={step} onValueChange={(n) => onChange(n[0] ?? 0)} />
    </div>
  );
}

function Divider() {
  return <div className="my-5 h-px w-full bg-border/40" />;
}

function fmtDb(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)} dB`;
}

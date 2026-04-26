import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ChevronLeft, Sparkles, Play, Pause, Volume2, Sliders, Maximize2, Layers, Share2, Loader2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { zodValidator } from "@tanstack/zod-adapter";
import { intentionSearchSchema } from "@/utils/intention";
import { ensureSetForRender, publishMaster, synthesizePreviewWav } from "@/utils/share";
import { renderSetMaster } from "@/utils/render";
import { toast } from "sonner";

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
  const { intention, dedicatedTo } = Route.useSearch();
  const navigate = useNavigate();
  const [lufs, setLufs] = useState(-14);
  const [low, setLow] = useState(0);
  const [mid, setMid] = useState(0);
  const [high, setHigh] = useState(0);
  const [width, setWidth] = useState(50);
  const [glue, setGlue] = useState(40);
  const [activePreset, setActivePreset] = useState<string | null>("Streaming (DSP)");
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0); // 0..1
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [renderStage, setRenderStage] = useState<string>("");

  const handlePublish = async () => {
    if (publishing) return;
    setPublishing(true);
    setRenderStage("Preparing set…");
    try {
      const setId = await ensureSetForRender(intention, dedicatedTo);
      // Try the real Assembly stitcher first; fall back to the synth preview
      // if the set has no decodable tracks yet.
      let wav: Blob | null = null;
      try {
        wav = await renderSetMaster(
          setId,
          { lufs, low, mid, high, width, glue },
          (msg) => setRenderStage(msg),
        );
      } catch (renderErr) {
        console.warn("[mastery] real render failed, using preview synth", renderErr);
      }
      if (!wav) {
        setRenderStage("No tracks yet — rendering preview…");
        wav = synthesizePreviewWav({ lufs, width, glue });
      }
      setRenderStage("Uploading…");
      const { shareUrl } = await publishMaster(setId, wav);
      toast.success("Shared. Link copied.", {
        action: { label: "Open", onClick: () => window.open(shareUrl, "_blank") },
      });
      try { await navigator.clipboard.writeText(shareUrl); } catch { /* ignore */ }
    } catch (e) {
      console.error(e);
      toast.error("Couldn't render & share. Please try again.");
    } finally {
      setPublishing(false);
      setRenderStage("");
    }
  };

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

  // Synthesized waveform — until a real assembled set is available, we render
  // a credible-looking envelope so the page is never empty. Deterministic.
  const samples = useMemo(() => {
    const N = 480;
    const arr = new Float32Array(N);
    let seed = 1337;
    const rand = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };
    for (let i = 0; i < N; i++) {
      const t = i / N;
      // Three-act envelope: rise, sustain, drop
      const env =
        Math.sin(Math.PI * t) * 0.7 +
        Math.sin(Math.PI * 6 * t) * 0.08 * (1 - t) +
        Math.sin(Math.PI * 14 * t) * 0.05;
      const noise = (rand() - 0.5) * 0.25;
      arr[i] = Math.max(-1, Math.min(1, env + noise));
    }
    return arr;
  }, []);

  // Draw waveform whenever EQ/width/glue change so the visual reflects mastering moves.
  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const W = cv.clientWidth;
    const H = cv.clientHeight;
    cv.width = W * dpr;
    cv.height = H * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, W, H);

    const mid = H / 2;
    const widthScale = 0.5 + (width / 100) * 0.6; // stereo width visual proxy
    const eqBias = (low * 0.04 + mid * 0.02 + high * 0.06);
    const glueScale = 1 - (glue / 100) * 0.18; // glue → softer peaks

    // Filled waveform
    ctx.beginPath();
    ctx.moveTo(0, mid);
    for (let i = 0; i < samples.length; i++) {
      const x = (i / samples.length) * W;
      const v = samples[i] * widthScale * glueScale + eqBias * 0.05;
      const y = mid - v * (H * 0.42);
      ctx.lineTo(x, y);
    }
    for (let i = samples.length - 1; i >= 0; i--) {
      const x = (i / samples.length) * W;
      const v = samples[i] * widthScale * glueScale + eqBias * 0.05;
      const y = mid + v * (H * 0.42);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, "oklch(0.62 0.16 30 / 0.85)");
    grad.addColorStop(0.5, "oklch(0.78 0.14 60 / 0.85)");
    grad.addColorStop(1, "oklch(0.55 0.13 150 / 0.85)");
    ctx.fillStyle = grad;
    ctx.fill();

    // Centerline
    ctx.strokeStyle = "oklch(0.5 0 0 / 0.25)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, mid);
    ctx.lineTo(W, mid);
    ctx.stroke();
  }, [samples, low, high, width, glue]);

  // Animate playhead (cosmetic — no audio yet)
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      setPlayhead((p) => {
        const next = p + dt / 60; // ~60s loop
        return next > 1 ? 0 : next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const onScrub = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    setPlayhead(Math.max(0, Math.min(1, x)));
  };

  return (
    <div className="relative flex min-h-[calc(100vh-4rem)] flex-col items-center px-4 py-20 md:px-6">
      <div className="mx-auto w-full max-w-4xl">
        <button
          type="button"
          onClick={() => navigate({ to: "/welcome" })}
          className="mb-10 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-warm-link/70 transition-opacity hover:opacity-100"
        >
          <ChevronLeft className="h-3 w-3" />
          Back
        </button>

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
            {dedicatedTo && <span className="italic normal-case text-foreground/70"> · for {dedicatedTo}</span>}
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

        {/* Effects rail — at the top */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-10 flex flex-wrap items-center gap-2 rounded-2xl border border-border/40 bg-card/40 p-2 backdrop-blur-sm"
        >
          <p className="px-3 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Effects</p>

          <EffectChip
            icon={<Volume2 className="h-3.5 w-3.5" />}
            label="Loudness"
            value={`${lufs} LUFS`}
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
          </EffectChip>

          <EffectChip
            icon={<Sliders className="h-3.5 w-3.5" />}
            label="EQ"
            value={`${fmtDb(low)} · ${fmtDb(mid)} · ${fmtDb(high)}`}
          >
            <ControlRow label="Low"  value={fmtDb(low)}  min={-6} max={6} step={0.5} v={low}  onChange={(n) => { setLow(n); setActivePreset(null); }} />
            <ControlRow label="Mid"  value={fmtDb(mid)}  min={-6} max={6} step={0.5} v={mid}  onChange={(n) => { setMid(n); setActivePreset(null); }} />
            <ControlRow label="High" value={fmtDb(high)} min={-6} max={6} step={0.5} v={high} onChange={(n) => { setHigh(n); setActivePreset(null); }} />
          </EffectChip>

          <EffectChip
            icon={<Maximize2 className="h-3.5 w-3.5" />}
            label="Width"
            value={`${width}%`}
          >
            <ControlRow label="Stereo width" value={`${width}%`} min={0} max={100} step={1} v={width} onChange={(n) => { setWidth(n); setActivePreset(null); }} />
          </EffectChip>

          <EffectChip
            icon={<Layers className="h-3.5 w-3.5" />}
            label="Glue"
            value={`${glue}%`}
          >
            <ControlRow label="Bus glue" value={`${glue}%`} min={0} max={100} step={1} v={glue} onChange={(n) => { setGlue(n); setActivePreset(null); }} />
          </EffectChip>
        </motion.div>

        {/* Full-width waveform — center, dominant */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-6 rounded-2xl border border-border/40 bg-card/40 p-4 backdrop-blur-sm"
        >
          <div className="flex items-center justify-between gap-3 px-1 pb-3">
            <button
              onClick={() => setPlaying((p) => !p)}
              aria-label={playing ? "Pause" : "Play"}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform hover:scale-105"
            >
              {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4 translate-x-[1px]" />}
            </button>
            <div className="flex-1 text-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              Full set preview
            </div>
            <div className="font-mono text-xs tabular-nums text-foreground">
              {fmtTime(playhead * 60)} / 01:00
            </div>
          </div>

          <div
            onClick={onScrub}
            className="relative h-44 cursor-pointer overflow-hidden rounded-lg bg-background/60"
          >
            <canvas ref={canvasRef} className="h-full w-full" />
            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 w-px bg-warm-link"
              style={{ left: `${playhead * 100}%` }}
            >
              <div className="absolute -top-1 -left-1 h-2 w-2 rounded-full bg-warm-link shadow-[0_0_10px_oklch(0.78_0.14_60)]" />
            </div>
          </div>

          {/* Thin LUFS strip under the waveform */}
          <div className="mt-3 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Output</span>
            <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-background/60">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-300"
                style={{
                  width: `${meter.norm * 100}%`,
                  background: "linear-gradient(90deg, oklch(0.55 0.13 150) 0%, oklch(0.78 0.14 60) 60%, oklch(0.62 0.18 30) 100%)",
                }}
              />
            </div>
            <span className="font-mono text-xs tabular-nums text-foreground">{lufs} LUFS</span>
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] uppercase tracking-[0.18em]", meter.safe ? "bg-primary-soft text-accent-foreground" : "bg-destructive/20 text-destructive")}>
              {meter.safe ? "Safe" : "Hot"}
            </span>
          </div>
        </motion.div>

        {/* Bottom: presets + export */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between"
        >
          <div className="min-w-0 flex-1">
            <p className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Translate to</p>
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
          </div>

          <button
            onClick={handlePublish}
            disabled={publishing}
            className="inline-flex items-center justify-center gap-2 rounded-full bg-warm-link px-5 py-3 text-xs uppercase tracking-[0.18em] text-background transition-all hover:scale-[1.02] disabled:opacity-60"
            title="Render the master, publish it, and copy a share link"
          >
            {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Share2 className="h-3.5 w-3.5" />}
            {publishing ? (renderStage || "Rendering…") : "Render & share"}
          </button>
        </motion.div>

        <p className="mt-6 text-xs italic text-muted-foreground/70">
          <Sparkles className="mr-1 inline h-3 w-3" />
          Preview waveform — once Assembly stitches your set, the real audio will load here.
        </p>
      </div>
    </div>
  );
}

function EffectChip({
  icon,
  label,
  value,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  children: React.ReactNode;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-foreground transition-all hover:border-warm-link/60"
          title={`${label} · ${value}`}
        >
          <span className="text-warm-link">{icon}</span>
          <span className="uppercase tracking-[0.18em] text-muted-foreground">{label}</span>
          <span className="font-mono text-[11px] tabular-nums text-foreground/80">{value}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        {children}
      </PopoverContent>
    </Popover>
  );
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = Math.floor(s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
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

function fmtDb(n: number) {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(1)} dB`;
}

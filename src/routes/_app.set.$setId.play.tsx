import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Loader2, X, Save, Sparkles } from "lucide-react";
import { useFlow } from "@/components/flow/flow-context";
import { StageCta, StageBack } from "@/components/flow/BreathShell";
import { Waveform } from "@/components/flow/Waveform";
import { LivePlayer, type PlayerSnapshot } from "@/utils/live-player";
import { combinedTransitionQuality, camelotColor } from "@/lib/camelot";
import { transitionLine } from "@/utils/companion-lines";
import {
  loadTransitions,
  saveTransitions,
  applyPreset,
  effectiveFade,
  PRESETS,
  type TransitionSetting,
  type TransitionType,
} from "@/utils/transitions";
import { logEvent } from "@/utils/telemetry";
import { cn, gradientFor } from "@/lib/utils";
import type { MirroredTrack } from "@/utils/set-mirror";

export const Route = createFileRoute("/_app/set/$setId/play")({
  component: PlayPage,
});

function fmt(sec: number): string {
  if (!Number.isFinite(sec) || sec < 0) sec = 0;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

type Timeline = { starts: number[]; durations: number[]; total: number };

/**
 * Time. To. Play. — the multi-lane mixer.
 * Tracks alternate across Deck A / Deck B (the way you'd really run them), so
 * each boundary IS a real crossfade. Click a clip to edit that transition.
 * Audio is the decoded-buffer engine, so what you hear is what you ship.
 */
function PlayPage() {
  const { setRow, tracks } = useFlow();
  const playable = useMemo(
    () => tracks.filter((t) => !!t.upload_url).sort((a, b) => a.position - b.position),
    [tracks],
  );
  const boundaries = Math.max(0, playable.length - 1);

  const playerRef = useRef<LivePlayer | null>(null);
  const [snap, setSnap] = useState<PlayerSnapshot>({
    playing: false,
    elapsed: 0,
    total: 0,
    currentIndex: 0,
    ready: false,
    ended: false,
  });
  const [timeline, setTimeline] = useState<Timeline>({ starts: [], durations: [], total: 0 });
  const [microcopy, setMicrocopy] = useState<string | null>(null);
  const [stalled, setStalled] = useState(false);
  const [transitions, setTransitions] = useState<TransitionSetting[]>(() =>
    loadTransitions(setRow.id, boundaries),
  );
  const [selected, setSelected] = useState<number | null>(null);
  const playedLogged = useRef(false);
  const microTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Build the player when the track list changes.
  useEffect(() => {
    if (playable.length === 0) return;
    const player = new LivePlayer(
      playable.map((t) => ({ id: t.id, title: t.title, artist: t.artist, url: t.upload_url! })),
      {
        onSnapshot: setSnap,
        onStall: () => {
          setStalled(true);
          setTimeout(() => setStalled(false), 2000);
        },
        onTransition: (from, to) => {
          const a = playable[from];
          const b = playable[to];
          if (a && b) {
            const q = combinedTransitionQuality(a.camelot_key, b.camelot_key, a.bpm, b.bpm);
            setMicrocopy(transitionLine(q, `${a.id}->${b.id}`));
            logEvent("transition_reached", { from, to, quality: q }, setRow.id);
            if (microTimer.current) clearTimeout(microTimer.current);
            microTimer.current = setTimeout(() => setMicrocopy(null), 4500);
          }
        },
        onEnded: () => setMicrocopy(null),
        onError: (m) => console.warn("[play]", m),
      },
    );
    playerRef.current = player;
    player.setFades(transitions.map(effectiveFade));
    void player.load().then(() => setTimeline(player.getTimeline()));
    return () => {
      player.dispose();
      playerRef.current = null;
      if (microTimer.current) clearTimeout(microTimer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playable.map((t) => t.id).join(","), setRow.id]);

  // Keep the timeline fresh when fades change the geometry.
  useEffect(() => {
    if (snap.ready && playerRef.current) setTimeline(playerRef.current.getTimeline());
  }, [snap.ready, snap.total]);

  const pushFades = useCallback(
    (next: TransitionSetting[]) => {
      setTransitions(next);
      saveTransitions(setRow.id, next);
      playerRef.current?.setFades(next.map(effectiveFade));
    },
    [setRow.id],
  );

  const toggle = useCallback(() => {
    const p = playerRef.current;
    if (!p) return;
    if (snap.playing) p.pause();
    else {
      if (!playedLogged.current) {
        playedLogged.current = true;
        logEvent("set_played", { tracks: playable.length }, setRow.id);
      }
      void p.play();
    }
  }, [snap.playing, playable.length, setRow.id]);

  if (playable.length < 2) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-sm italic text-muted-foreground">
          a set needs at least two tracks to mix.
        </p>
        <StageBack to="dig" setId={setRow.id} label="back to the dig" />
      </div>
    );
  }

  const total = timeline.total || snap.total || 1;
  const pct = (sec: number) => `${Math.max(0, Math.min(100, (sec / total) * 100))}%`;
  const deckA = playable.map((t, i) => ({ t, i })).filter((x) => x.i % 2 === 0);
  const deckB = playable.map((t, i) => ({ t, i })).filter((x) => x.i % 2 === 1);

  return (
    <div className="flex flex-1 flex-col">
      {/* sub-header: transport */}
      <div className="mt-4 flex items-center justify-between">
        <p className="text-sm italic text-muted-foreground">
          two decks, one breath — click a blend to shape it.
        </p>
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs text-muted-foreground/70">
            {fmt(snap.elapsed)} / {snap.ready ? fmt(total) : "…"}
          </span>
          <button
            type="button"
            onClick={toggle}
            disabled={!snap.ready}
            aria-label={snap.playing ? "Pause" : "Play"}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-full bg-warm-link/15 text-warm-link transition-all hover:bg-warm-link/25",
              !snap.ready && "opacity-40",
            )}
          >
            {!snap.ready ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : snap.playing ? (
              <Pause className="h-4 w-4" />
            ) : (
              <Play className="ml-0.5 h-4 w-4" />
            )}
          </button>
        </div>
      </div>

      <div className="mt-4 flex gap-4">
        {/* LEFT: timeline + lanes */}
        <div className="min-w-0 flex-1">
          {/* progress */}
          <div className="h-1 w-full overflow-hidden rounded-full bg-secondary/60">
            <div
              className="h-full rounded-full bg-warm-link"
              style={{ width: pct(snap.elapsed) }}
            />
          </div>

          {/* whole-set energy arc */}
          <div className="relative mt-3 h-16 w-full">
            <EnergyArc tracks={playable} />
            <Playhead left={pct(snap.elapsed)} />
          </div>
          <p className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-muted-foreground/50">
            whole-set energy arc
          </p>

          {/* lanes */}
          <div className="relative mt-3 space-y-2">
            <Lane label="Deck A" accent="hsl(215 50% 55%)">
              {deckA.map(({ t, i }) => (
                <Clip
                  key={t.id}
                  track={t}
                  left={pct(timeline.starts[i] ?? 0)}
                  width={pct(timeline.durations[i] ?? 0)}
                  active={selected === i || selected === i - 1}
                  current={snap.currentIndex === i}
                  onClick={() => i < boundaries && setSelected(i)}
                />
              ))}
            </Lane>
            <Lane label="Deck B" accent="hsl(2 55% 60%)">
              {deckB.map(({ t, i }) => (
                <Clip
                  key={t.id}
                  track={t}
                  left={pct(timeline.starts[i] ?? 0)}
                  width={pct(timeline.durations[i] ?? 0)}
                  active={selected === i || selected === i - 1}
                  current={snap.currentIndex === i}
                  onClick={() => (i < boundaries ? setSelected(i) : setSelected(i - 1))}
                  tint
                />
              ))}
            </Lane>

            {/* FX + Background lanes (visual; populate once sounds are added) */}
            <Lane label="FX" muted>
              <LaneHint>short clips — drop a riser or 808 here</LaneHint>
            </Lane>
            <Lane label="Background" muted>
              <LaneHint>a vinyl crackle / rain bed can span the whole mix</LaneHint>
            </Lane>

            {/* playhead across all lanes */}
            <div
              className="pointer-events-none absolute inset-y-0 w-px bg-foreground/40"
              style={{ left: pct(snap.elapsed) }}
            />
          </div>

          {/* companion line */}
          <div className="mt-3 h-5">
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
              {stalled && !microcopy && (
                <p className="text-[11px] italic text-muted-foreground/70">buffering — hang on…</p>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* RIGHT: edit transition */}
        <div className="hidden w-[300px] shrink-0 lg:block">
          <AnimatePresence mode="wait">
            {selected !== null && playable[selected] && playable[selected + 1] ? (
              <TransitionEditor
                key={selected}
                from={playable[selected]}
                to={playable[selected + 1]}
                setting={transitions[selected]}
                onChange={(s) => {
                  const next = transitions.slice();
                  next[selected] = s;
                  pushFades(next);
                }}
                onClose={() => setSelected(null)}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-border/60 p-6 text-center text-sm italic text-muted-foreground">
                click a clip to shape the blend into the next track.
              </div>
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="flex-1" />
      <StageCta to="polish" setId={setRow.id} hint="when it sounds right">
        Sounds right → polish it
      </StageCta>
      <StageBack to="order" setId={setRow.id} label="back to the order" />
    </div>
  );
}

/* ---------- lanes ---------- */

function Lane({
  label,
  accent,
  muted,
  children,
}: {
  label: string;
  accent?: string;
  muted?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-stretch gap-2">
      <div className="flex w-20 shrink-0 items-center gap-1.5">
        <span
          className="h-3 w-1 rounded-full"
          style={{ background: accent ?? "var(--border)" }}
          aria-hidden
        />
        <span className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground/70">
          {label}
        </span>
      </div>
      <div
        className={cn(
          "relative h-14 flex-1 rounded-xl border",
          muted ? "border-dashed border-border/50 bg-card/20" : "border-border/40 bg-card/30",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function LaneHint({ children }: { children: React.ReactNode }) {
  return (
    <span className="absolute inset-0 flex items-center justify-center text-[11px] italic text-muted-foreground/50">
      {children}
    </span>
  );
}

function Clip({
  track,
  left,
  width,
  active,
  current,
  onClick,
  tint,
}: {
  track: MirroredTrack;
  left: string;
  width: string;
  active: boolean;
  current: boolean;
  onClick: () => void;
  tint?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "absolute inset-y-1 overflow-hidden rounded-lg border px-2 text-left transition-all",
        tint ? "bg-[hsl(2_50%_60%/0.12)]" : "bg-[hsl(215_45%_55%/0.12)]",
        active
          ? "border-warm-link ring-1 ring-warm-link"
          : "border-border/50 hover:border-warm-link/60",
        current && "shadow-[0_0_18px_-4px_var(--warm-link)]",
      )}
      style={{ left, width }}
      title={`${track.title} — shape the blend`}
    >
      <span className="block truncate pt-1 text-[11px] font-medium text-foreground">
        {track.title}
      </span>
      <span
        className={cn(
          "mt-0.5 block h-5",
          tint ? "text-[hsl(2_55%_55%)]" : "text-[hsl(215_50%_50%)]",
        )}
      >
        <Waveform seed={track.title} count={28} barClassName="opacity-70" />
      </span>
    </button>
  );
}

function Playhead({ left }: { left: string }) {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 z-10 w-px bg-foreground/40"
      style={{ left }}
    />
  );
}

function EnergyArc({ tracks }: { tracks: MirroredTrack[] }) {
  // A smooth bell from the tracks' energies (fallback: symmetric hill).
  const pts = tracks.map((t, i) => {
    const x = tracks.length === 1 ? 0.5 : i / (tracks.length - 1);
    const e =
      t.energy !== null && t.energy !== undefined
        ? t.energy / 100
        : 0.35 + 0.5 * Math.sin(Math.PI * x); // hill fallback
    return { x, y: 1 - Math.max(0.08, Math.min(1, e)) };
  });
  const W = 100;
  const H = 100;
  const path =
    pts.length > 1
      ? pts
          .map((p, i) => {
            const X = p.x * W;
            const Y = 8 + p.y * (H - 16);
            if (i === 0) return `M ${X} ${Y}`;
            const prev = pts[i - 1];
            const mx = ((prev.x + p.x) / 2) * W;
            return `Q ${prev.x * W} ${8 + prev.y * (H - 16)} ${mx} ${8 + ((prev.y + p.y) / 2) * (H - 16)} T ${X} ${Y}`;
          })
          .join(" ")
      : `M 0 50 L 100 50`;
  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="absolute inset-0 h-full w-full"
    >
      <defs>
        <linearGradient id="gr-arc" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="hsl(215 50% 55%)" stopOpacity="0.25" />
          <stop offset="60%" stopColor="hsl(2 55% 60%)" stopOpacity="0.30" />
          <stop offset="100%" stopColor="hsl(215 50% 55%)" stopOpacity="0.15" />
        </linearGradient>
      </defs>
      <path d={`${path} L 100 100 L 0 100 Z`} fill="url(#gr-arc)" />
      <path
        d={path}
        fill="none"
        stroke="var(--warm-link)"
        strokeWidth={1}
        opacity={0.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

/* ---------- transition editor ---------- */

function TransitionEditor({
  from,
  to,
  setting,
  onChange,
  onClose,
}: {
  from: MirroredTrack;
  to: MirroredTrack;
  setting: TransitionSetting;
  onChange: (s: TransitionSetting) => void;
  onClose: () => void;
}) {
  const quality = combinedTransitionQuality(from.camelot_key, to.camelot_key, from.bpm, to.bpm);
  return (
    <motion.div
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 12 }}
      className="rounded-2xl border border-border/60 bg-card/60 p-4 backdrop-blur-sm"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="font-display text-sm text-foreground">Edit transition</span>
          <span className="rounded bg-warm-link/15 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-warm-link">
            beta
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {[from, to].map((t, i) => (
        <div key={t.id} className="mb-1.5 flex items-center gap-2">
          <span
            className="h-8 w-8 shrink-0 rounded-md"
            style={{ background: gradientFor(t.title) }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium text-foreground">{t.title}</p>
            <p className="truncate text-[10px] text-muted-foreground">{t.artist ?? "—"}</p>
          </div>
          <span className="font-mono text-[10px] text-muted-foreground">
            {t.bpm ? `${Math.round(t.bpm)}` : "—"}
          </span>
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-medium"
            style={{
              color: camelotColor(t.camelot_key),
              border: `1px solid ${camelotColor(t.camelot_key)}`,
            }}
          >
            {t.camelot_key ?? "—"}
            {i === 0 ? "" : ""}
          </span>
        </div>
      ))}

      {/* transition viz */}
      <div className="my-3 flex h-12 items-center gap-0.5 overflow-hidden rounded-lg border border-border/40 bg-background/40 px-1">
        <span className="h-8 flex-1 text-[hsl(215_50%_50%)]">
          <Waveform seed={from.title} count={22} barClassName="opacity-60" />
        </span>
        <span className="text-[10px] text-warm-link">⟶</span>
        <span className="h-8 flex-1 text-[hsl(2_55%_55%)]">
          <Waveform seed={to.title} count={22} barClassName="opacity-60" />
        </span>
      </div>

      {/* presets */}
      <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
        Presets
      </p>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange(applyPreset(setting, p.id))}
            title={p.note}
            className={cn(
              "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] transition-all",
              setting.preset === p.id
                ? "bg-warm-link text-background"
                : "border border-border/60 text-foreground/85 hover:border-warm-link",
            )}
          >
            {p.id === "auto" && <Sparkles className="h-3 w-3" />}
            {p.label}
          </button>
        ))}
      </div>

      <Row label="Volume" value={setting.volume} />
      <Row label="EQ" value={setting.eq} />
      <Row label="Filter" value={setting.filter} />

      {/* length */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          <span>Length</span>
          <span className="font-mono text-warm-link">{setting.length.toFixed(1)}s</span>
        </div>
        <input
          type="range"
          min={1}
          max={12}
          step={0.5}
          value={setting.length}
          onChange={(e) => onChange({ ...setting, length: Number(e.target.value) })}
          className="mt-1 w-full accent-warm-link"
        />
      </div>

      {/* type */}
      <div className="mt-3">
        <p className="mb-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground/60">
          Type
        </p>
        <div className="flex gap-1.5">
          {(["overlay", "cut", "gap"] as TransitionType[]).map((ty) => (
            <button
              key={ty}
              type="button"
              onClick={() => onChange({ ...setting, type: ty })}
              className={cn(
                "flex-1 rounded-lg py-1.5 text-[11px] capitalize transition-all",
                setting.type === ty
                  ? "bg-warm-link/20 text-warm-link ring-1 ring-warm-link/50"
                  : "border border-border/50 text-foreground/80 hover:border-warm-link/60",
              )}
            >
              {ty}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span className="text-[10px] italic text-muted-foreground/60">{quality} blend</span>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-1.5 rounded-full bg-warm-link/15 px-3 py-1 text-xs text-warm-link hover:bg-warm-link/25"
        >
          <Save className="h-3 w-3" /> Done
        </button>
      </div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-t border-border/40 py-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground/85">{value}</span>
    </div>
  );
}

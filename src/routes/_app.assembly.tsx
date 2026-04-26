import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, useCallback, type PointerEvent } from "react";
import {
  Play,
  Pause,
  Square,
  Circle,
  SkipBack,
  SkipForward,
  Plus,
  ZoomIn,
  ZoomOut,
  Magnet,
  ArrowRight,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { zodValidator } from "@tanstack/zod-adapter";
import { intentionSearchSchema } from "@/utils/intention";
import { ensureUserId, findTodaySet } from "@/utils/today-set";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/assembly")({
  validateSearch: zodValidator(intentionSearchSchema),
  component: AssemblyWorkspace,
});

type ClipColor = "mustard" | "terracotta" | "forest" | "cream";

type Clip = {
  id: string;
  start: number; // seconds
  duration: number; // seconds
  color: ClipColor;
  seed: number;
};

type Track = {
  id: string;
  name: string;
  muted: boolean;
  solo: boolean;
  volume: number;
  color: ClipColor;
  clips: Clip[];
};

const COLOR_VAR: Record<ClipColor, string> = {
  mustard: "oklch(0.84 0.16 90)",
  terracotta: "oklch(0.68 0.17 50)",
  forest: "oklch(0.55 0.1 145)",
  cream: "oklch(0.92 0.04 85)",
};

const TOTAL_SECONDS = 180; // 3 min canvas
const HEADER_W = 220;

function seededRand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function makeWaveformPath(width: number, height: number, seed: number, samples = 80) {
  const rand = seededRand(seed);
  const mid = height / 2;
  const step = width / samples;
  let d = `M 0 ${mid}`;
  for (let i = 0; i <= samples; i++) {
    const x = i * step;
    const amp = (rand() * 0.7 + 0.15) * mid;
    d += ` L ${x.toFixed(1)} ${(mid - amp).toFixed(1)}`;
  }
  for (let i = samples; i >= 0; i--) {
    const x = i * step;
    const amp = (seededRand(seed + i)() * 0.7 + 0.15) * mid;
    d += ` L ${x.toFixed(1)} ${(mid + amp).toFixed(1)}`;
  }
  d += " Z";
  return d;
}

function fmtTime(s: number) {
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  const cs = Math.floor((s % 1) * 100);
  return `${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}:${String(cs).padStart(2, "0")}`;
}

const initialTracks: Track[] = [
  {
    id: "t1",
    name: "Vocals",
    muted: false,
    solo: false,
    volume: 80,
    color: "mustard",
    clips: [
      { id: "c1", start: 4, duration: 22, color: "mustard", seed: 11 },
      { id: "c2", start: 40, duration: 30, color: "mustard", seed: 22 },
    ],
  },
  {
    id: "t2",
    name: "Drums",
    muted: false,
    solo: false,
    volume: 90,
    color: "terracotta",
    clips: [
      { id: "c3", start: 0, duration: 60, color: "terracotta", seed: 33 },
      { id: "c4", start: 70, duration: 40, color: "terracotta", seed: 44 },
    ],
  },
  {
    id: "t3",
    name: "Bass",
    muted: false,
    solo: false,
    volume: 70,
    color: "forest",
    clips: [{ id: "c5", start: 8, duration: 90, color: "forest", seed: 55 }],
  },
  {
    id: "t4",
    name: "FX",
    muted: false,
    solo: false,
    volume: 50,
    color: "cream",
    clips: [
      { id: "c6", start: 30, duration: 8, color: "cream", seed: 66 },
      { id: "c7", start: 95, duration: 12, color: "cream", seed: 77 },
    ],
  },
];

function AssemblyWorkspace() {
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [playing, setPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [bpm, setBpm] = useState(124);
  const [pxPerSec, setPxPerSec] = useState(14);
  const [snap, setSnap] = useState(true);
  const lanesScrollRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  // Playhead animation
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
      return;
    }
    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts;
      const dt = (ts - lastTsRef.current) / 1000;
      lastTsRef.current = ts;
      setPlayhead((p) => {
        const next = p + dt;
        if (next >= TOTAL_SECONDS) {
          setPlaying(false);
          return TOTAL_SECONDS;
        }
        return next;
      });
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing]);

  const totalWidth = TOTAL_SECONDS * pxPerSec;

  const updateClip = (trackId: string, clipId: string, patch: Partial<Clip>) => {
    setTracks((ts) =>
      ts.map((t) =>
        t.id !== trackId
          ? t
          : { ...t, clips: t.clips.map((c) => (c.id === clipId ? { ...c, ...patch } : c)) },
      ),
    );
  };

  const addTrack = () => {
    const palette: ClipColor[] = ["mustard", "terracotta", "forest", "cream"];
    const color = palette[tracks.length % palette.length];
    setTracks((ts) => [
      ...ts,
      {
        id: `t${Date.now()}`,
        name: `Track ${ts.length + 1}`,
        muted: false,
        solo: false,
        volume: 75,
        color,
        clips: [],
      },
    ]);
  };

  const renameTrack = (id: string, name: string) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, name } : t)));
  const toggleMute = (id: string) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, muted: !t.muted } : t)));
  const toggleSolo = (id: string) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, solo: !t.solo } : t)));
  const setVolume = (id: string, v: number) =>
    setTracks((ts) => ts.map((t) => (t.id === id ? { ...t, volume: v } : t)));

  const seekFromEvent = (e: PointerEvent<HTMLDivElement>) => {
    const lane = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - lane.left + (lanesScrollRef.current?.scrollLeft ?? 0);
    const t = Math.max(0, Math.min(TOTAL_SECONDS, x / pxPerSec));
    setPlayhead(t);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top transport bar */}
      <TransportBar
        playing={playing}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onStop={() => {
          setPlaying(false);
          setPlayhead(0);
        }}
        onSkipBack={() => setPlayhead(0)}
        onSkipForward={() => setPlayhead(TOTAL_SECONDS)}
        playhead={playhead}
        bpm={bpm}
        setBpm={setBpm}
        pxPerSec={pxPerSec}
        setPxPerSec={setPxPerSec}
        snap={snap}
        setSnap={setSnap}
      />

      {/* Main editor area */}
      <div className="relative flex flex-1 overflow-hidden border-t border-border">
        {/* Track headers (left, sticky) */}
        <div
          className="flex flex-col border-r border-border bg-sidebar"
          style={{ width: HEADER_W, minWidth: HEADER_W }}
        >
          <div className="h-8 border-b border-border" />
          {tracks.map((t) => (
            <TrackHeader
              key={t.id}
              track={t}
              onRename={(n) => renameTrack(t.id, n)}
              onMute={() => toggleMute(t.id)}
              onSolo={() => toggleSolo(t.id)}
              onVolume={(v) => setVolume(t.id, v)}
            />
          ))}
          <button
            onClick={addTrack}
            className="m-3 flex items-center justify-center gap-2 rounded-md border border-dashed border-border px-3 py-3 text-xs uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:border-primary hover:text-primary"
          >
            <Plus className="h-3.5 w-3.5" /> Add track
          </button>
        </div>

        {/* Scrollable lane area */}
        <div ref={lanesScrollRef} className="relative flex-1 overflow-x-auto overflow-y-auto">
          <div style={{ width: totalWidth, minWidth: "100%" }} className="relative">
            {/* Ruler */}
            <Ruler totalSeconds={TOTAL_SECONDS} pxPerSec={pxPerSec} />

            {/* Lanes */}
            {tracks.map((t, idx) => (
              <Lane
                key={t.id}
                track={t}
                pxPerSec={pxPerSec}
                snap={snap}
                onClipChange={(clipId, patch) => updateClip(t.id, clipId, patch)}
                onSeek={seekFromEvent}
                stripe={idx % 2 === 0}
              />
            ))}

            {/* Playhead */}
            <div
              className="pointer-events-none absolute top-0 bottom-0 z-30 w-px bg-primary"
              style={{
                left: playhead * pxPerSec,
                boxShadow: "0 0 8px var(--primary)",
              }}
            >
              <div className="absolute -top-1 -left-[5px] h-3 w-[11px] rotate-45 bg-primary" />
            </div>
          </div>
        </div>

        {/* Empty-state CTA pinned to corner */}
        <Link
          to="/"
          className="absolute right-4 bottom-4 z-40 flex items-center gap-2 rounded-full border border-border bg-card/80 px-4 py-2 text-xs uppercase tracking-[0.18em] text-muted-foreground backdrop-blur transition-colors hover:border-primary hover:text-primary"
        >
          Got a setlist? Build it in the Set Studio
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

/* ---------------- Transport ---------------- */

function TransportBar(props: {
  playing: boolean;
  onPlay: () => void;
  onPause: () => void;
  onStop: () => void;
  onSkipBack: () => void;
  onSkipForward: () => void;
  playhead: number;
  bpm: number;
  setBpm: (v: number) => void;
  pxPerSec: number;
  setPxPerSec: (v: number) => void;
  snap: boolean;
  setSnap: (v: boolean) => void;
}) {
  const {
    playing,
    onPlay,
    onPause,
    onStop,
    onSkipBack,
    onSkipForward,
    playhead,
    bpm,
    setBpm,
    pxPerSec,
    setPxPerSec,
    snap,
    setSnap,
  } = props;

  const Btn = ({
    onClick,
    children,
    active,
    danger,
    label,
  }: {
    onClick: () => void;
    children: React.ReactNode;
    active?: boolean;
    danger?: boolean;
    label: string;
  }) => (
    <button
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "flex h-9 w-9 items-center justify-center rounded-md border border-transparent text-foreground/80 transition-all",
        "hover:border-border hover:bg-secondary",
        active && "border-primary text-primary",
        danger && "hover:text-destructive",
      )}
    >
      {children}
    </button>
  );

  return (
    <div className="flex h-14 shrink-0 items-center gap-3 px-4 pl-6">
      <div className="flex items-center gap-1">
        <Btn label="Skip to start" onClick={onSkipBack}>
          <SkipBack className="h-4 w-4" />
        </Btn>
        {playing ? (
          <Btn label="Pause" onClick={onPause} active>
            <Pause className="h-4 w-4" />
          </Btn>
        ) : (
          <Btn label="Play" onClick={onPlay}>
            <Play className="h-4 w-4" />
          </Btn>
        )}
        <Btn label="Stop" onClick={onStop}>
          <Square className="h-4 w-4" />
        </Btn>
        <Btn label="Skip to end" onClick={onSkipForward}>
          <SkipForward className="h-4 w-4" />
        </Btn>
        <Btn label="Record" onClick={() => {}} danger>
          <Circle className="h-4 w-4" />
        </Btn>
      </div>

      <div className="ml-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm tabular-nums">
        <span className="text-primary">{fmtTime(playhead)}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">{fmtTime(TOTAL_SECONDS)}</span>
      </div>

      <div className="ml-auto flex items-center gap-4">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-muted-foreground">
          <span>BPM</span>
          <input
            type="number"
            value={bpm}
            min={40}
            max={220}
            onChange={(e) => setBpm(Number(e.target.value) || 0)}
            className="w-16 rounded-md border border-border bg-card px-2 py-1 font-mono text-sm text-foreground focus:border-primary focus:outline-none"
          />
        </div>

        <div className="flex items-center gap-1">
          <Btn label="Zoom out" onClick={() => setPxPerSec(Math.max(4, pxPerSec - 4))}>
            <ZoomOut className="h-4 w-4" />
          </Btn>
          <span className="w-10 text-center text-xs tabular-nums text-muted-foreground">
            {pxPerSec}px/s
          </span>
          <Btn label="Zoom in" onClick={() => setPxPerSec(Math.min(60, pxPerSec + 4))}>
            <ZoomIn className="h-4 w-4" />
          </Btn>
        </div>

        <Btn label="Snap" onClick={() => setSnap(!snap)} active={snap}>
          <Magnet className="h-4 w-4" />
        </Btn>
      </div>
    </div>
  );
}

/* ---------------- Track header ---------------- */

function TrackHeader({
  track,
  onRename,
  onMute,
  onSolo,
  onVolume,
}: {
  track: Track;
  onRename: (n: string) => void;
  onMute: () => void;
  onSolo: () => void;
  onVolume: (v: number) => void;
}) {
  return (
    <div className="flex h-24 flex-col gap-2 border-b border-border px-3 py-2">
      <div className="flex items-center gap-2">
        <span
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ background: COLOR_VAR[track.color] }}
        />
        <input
          value={track.name}
          onChange={(e) => onRename(e.target.value)}
          className="w-full bg-transparent text-sm font-medium text-foreground focus:outline-none"
        />
      </div>
      <div className="flex items-center gap-1.5">
        <button
          onClick={onMute}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold uppercase transition-colors",
            track.muted
              ? "bg-destructive text-destructive-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
          title="Mute"
        >
          M
        </button>
        <button
          onClick={onSolo}
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold uppercase transition-colors",
            track.solo
              ? "bg-primary text-primary-foreground"
              : "bg-secondary text-muted-foreground hover:text-foreground",
          )}
          title="Solo"
        >
          S
        </button>
        <Slider
          value={[track.volume]}
          min={0}
          max={100}
          step={1}
          onValueChange={(v) => onVolume(v[0] ?? 0)}
          className="flex-1"
        />
      </div>
    </div>
  );
}

/* ---------------- Ruler ---------------- */

function Ruler({ totalSeconds, pxPerSec }: { totalSeconds: number; pxPerSec: number }) {
  const major = pxPerSec >= 20 ? 5 : pxPerSec >= 10 ? 10 : 30;
  const ticks = [];
  for (let s = 0; s <= totalSeconds; s++) {
    const isMajor = s % major === 0;
    ticks.push(
      <div
        key={s}
        className={cn(
          "absolute top-0 bg-border",
          isMajor ? "h-full w-px" : "h-2 w-px opacity-50",
        )}
        style={{ left: s * pxPerSec }}
      >
        {isMajor && (
          <span className="absolute top-1 left-1 text-[10px] tabular-nums text-muted-foreground">
            {fmtMinSec(s)}
          </span>
        )}
      </div>,
    );
  }
  return (
    <div className="sticky top-0 z-20 h-8 border-b border-border bg-card">
      <div className="relative h-full">{ticks}</div>
    </div>
  );
}

function fmtMinSec(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

/* ---------------- Lane ---------------- */

function Lane({
  track,
  pxPerSec,
  snap,
  onClipChange,
  onSeek,
  stripe,
}: {
  track: Track;
  pxPerSec: number;
  snap: boolean;
  onClipChange: (clipId: string, patch: Partial<Clip>) => void;
  onSeek: (e: PointerEvent<HTMLDivElement>) => void;
  stripe: boolean;
}) {
  const onLanePointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest("[data-clip]")) return;
    onSeek(e);
  };

  return (
    <div
      onPointerDown={onLanePointerDown}
      className={cn(
        "relative h-24 border-b border-border",
        stripe ? "bg-background" : "bg-secondary/30",
        track.muted && "opacity-40",
      )}
    >
      {track.clips.map((clip) => (
        <ClipBlock
          key={clip.id}
          clip={clip}
          pxPerSec={pxPerSec}
          snap={snap}
          onChange={(patch) => onClipChange(clip.id, patch)}
        />
      ))}
    </div>
  );
}

/* ---------------- Clip ---------------- */

function ClipBlock({
  clip,
  pxPerSec,
  snap,
  onChange,
}: {
  clip: Clip;
  pxPerSec: number;
  snap: boolean;
  onChange: (patch: Partial<Clip>) => void;
}) {
  const [drag, setDrag] = useState<
    | { mode: "move"; startX: number; startVal: number }
    | { mode: "resize"; startX: number; startVal: number }
    | null
  >(null);

  const left = clip.start * pxPerSec;
  const width = Math.max(20, clip.duration * pxPerSec);
  const color = COLOR_VAR[clip.color];

  const wavePath = useMemo(
    () => makeWaveformPath(width, 64, clip.seed),
    [width, clip.seed],
  );

  const snapVal = (s: number) => (snap ? Math.round(s * 4) / 4 : s);

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    if (!drag) return;
    const dx = e.clientX - drag.startX;
    const ds = dx / pxPerSec;
    if (drag.mode === "move") {
      const next = Math.max(0, snapVal(drag.startVal + ds));
      onChange({ start: Math.min(next, TOTAL_SECONDS - clip.duration) });
    } else {
      const next = Math.max(0.5, snapVal(drag.startVal + ds));
      onChange({ duration: Math.min(next, TOTAL_SECONDS - clip.start) });
    }
  };

  const stop = (e: PointerEvent<HTMLDivElement>) => {
    if (drag) {
      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      setDrag(null);
    }
  };

  return (
    <div
      data-clip
      className="absolute top-2 bottom-2 overflow-hidden rounded-md border border-foreground/10 shadow-sm"
      style={{
        left,
        width,
        background: `linear-gradient(180deg, ${color} 0%, color-mix(in oklab, ${color} 70%, black) 100%)`,
      }}
      onPointerDown={(e) => {
        if ((e.target as HTMLElement).dataset.handle === "resize") return;
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        setDrag({ mode: "move", startX: e.clientX, startVal: clip.start });
      }}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerCancel={stop}
    >
      <svg
        viewBox={`0 0 ${width} 64`}
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <path d={wavePath} fill="rgba(0,0,0,0.35)" />
      </svg>
      <div className="absolute top-1 left-2 text-[10px] font-medium uppercase tracking-wider text-foreground/80 mix-blend-overlay">
        {clip.duration.toFixed(1)}s
      </div>
      <div
        data-handle="resize"
        onPointerDown={(e) => {
          e.stopPropagation();
          (e.currentTarget.parentElement as HTMLElement).setPointerCapture(e.pointerId);
          setDrag({ mode: "resize", startX: e.clientX, startVal: clip.duration });
        }}
        className="absolute top-0 right-0 h-full w-1.5 cursor-ew-resize bg-foreground/30 hover:bg-foreground/60"
      />
    </div>
  );
}

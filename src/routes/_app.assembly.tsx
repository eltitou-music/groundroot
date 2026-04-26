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
import { useFocusHandoff } from "@/hooks/useFocusHandoff";

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

/* ---------------- Real audio engine ---------------- */

type LoadedClip = {
  id: string;
  title: string;
  buffer: AudioBuffer;
  start: number;   // timeline start (s)
  duration: number;
};

const CROSSFADE = 2; // seconds, matches the master render

/**
 * Loads today's set tracks, decodes them, lays them out end-to-end with
 * a 2s crossfade overlap, and exposes play / pause / stop / seek that
 * actually drive a Web Audio graph synchronized to the visual playhead.
 */
function useSetAudioEngine(playhead: number, setPlayhead: (n: number) => void) {
  const ctxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const liveSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const rafRef = useRef<number | null>(null);
  const startedAtCtxRef = useRef<number>(0);   // ctx.currentTime at last play()
  const startedAtHeadRef = useRef<number>(0);  // playhead at last play()
  const [clips, setClips] = useState<LoadedClip[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [playing, setPlaying] = useState(false);

  const totalDuration = useMemo(() => {
    if (clips.length === 0) return 0;
    const last = clips[clips.length - 1];
    return last.start + last.duration;
  }, [clips]);

  // Load + decode tracks for today's set. Runs once on mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const uid = await ensureUserId();
        const today = await findTodaySet(uid);
        if (!today) {
          setLoading(false);
          return;
        }
        const { data, error } = await supabase
          .from("tracks")
          .select("id, title, upload_url, position")
          .eq("set_id", today.id)
          .order("position", { ascending: true });
        if (error) throw error;
        const playable = (data ?? []).filter((t) => !!t.upload_url);
        if (playable.length === 0) {
          setLoading(false);
          return;
        }
        const Ctx: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext })
            .webkitAudioContext;
        const tmp = new Ctx();
        const decoded: LoadedClip[] = [];
        let cursor = 0;
        for (const t of playable) {
          try {
            const resp = await fetch(t.upload_url as string);
            if (!resp.ok) continue;
            const arr = await resp.arrayBuffer();
            const buf = await tmp.decodeAudioData(arr);
            decoded.push({
              id: t.id,
              title: t.title,
              buffer: buf,
              start: cursor,
              duration: buf.duration,
            });
            const advance =
              decoded.length === playable.length
                ? buf.duration
                : Math.max(0.5, buf.duration - CROSSFADE);
            cursor += advance;
          } catch (e) {
            console.warn("[assembly] couldn't decode", t.title, e);
          }
        }
        await tmp.close().catch(() => undefined);
        if (cancelled) return;
        setClips(decoded);
        setLoading(false);
      } catch (e) {
        if (cancelled) return;
        setLoadErr(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Build / lazily resume the audio context. Must be called from a user
  // gesture (browsers block AudioContext creation otherwise).
  const ensureCtx = useCallback(async () => {
    if (!ctxRef.current) {
      const Ctx: typeof AudioContext =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const ctx = new Ctx();
      const g = ctx.createGain();
      g.gain.value = muted ? 0 : 1;
      g.connect(ctx.destination);
      ctxRef.current = ctx;
      masterGainRef.current = g;
    }
    if (ctxRef.current.state === "suspended") {
      await ctxRef.current.resume();
    }
    return ctxRef.current;
  }, [muted]);

  const stopAllSources = useCallback(() => {
    for (const s of liveSourcesRef.current) {
      try {
        s.stop();
      } catch {
        /* already stopped */
      }
      s.disconnect();
    }
    liveSourcesRef.current = [];
  }, []);

  // Schedule clips on the bus starting at the given playhead offset.
  const scheduleFrom = useCallback(
    (fromHead: number) => {
      const ctx = ctxRef.current;
      const bus = masterGainRef.current;
      if (!ctx || !bus) return;
      stopAllSources();
      const now = ctx.currentTime + 0.05;
      startedAtCtxRef.current = now;
      startedAtHeadRef.current = fromHead;

      for (const clip of clips) {
        const clipEnd = clip.start + clip.duration;
        if (clipEnd <= fromHead) continue;
        const skipInto = Math.max(0, fromHead - clip.start);
        const startAt = now + Math.max(0, clip.start - fromHead);
        const playDur = clip.duration - skipInto;

        const src = ctx.createBufferSource();
        src.buffer = clip.buffer;
        const g = ctx.createGain();

        const isFirst = clip === clips[0];
        const isLast = clip === clips[clips.length - 1];
        const fadeIn = !isFirst && skipInto < CROSSFADE ? CROSSFADE - skipInto : 0;
        const fadeOut = !isLast ? CROSSFADE : 0;

        g.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, startAt);
        if (fadeIn > 0) g.gain.exponentialRampToValueAtTime(1, startAt + fadeIn);
        if (fadeOut > 0 && playDur > fadeOut) {
          const fOutStart = startAt + (playDur - fadeOut);
          g.gain.setValueAtTime(1, fOutStart);
          g.gain.exponentialRampToValueAtTime(0.0001, startAt + playDur);
        }
        src.connect(g).connect(bus);
        src.start(startAt, skipInto);
        src.stop(startAt + playDur + 0.05);
        liveSourcesRef.current.push(src);
      }
    },
    [clips, stopAllSources],
  );

  const play = useCallback(async () => {
    if (clips.length === 0) {
      // No real audio yet → just toggle visual playhead.
      setPlaying(true);
      return;
    }
    try {
      await ensureCtx();
    } catch (e) {
      console.error("[engine] ensureCtx failed", e);
      toast.error("Couldn't start audio context.");
      return;
    }
    const fromHead = playhead >= totalDuration ? 0 : playhead;
    if (fromHead !== playhead) setPlayhead(fromHead);
    scheduleFrom(fromHead);
    setPlaying(true);
  }, [clips.length, ensureCtx, playhead, scheduleFrom, setPlayhead, totalDuration]);

  const pause = useCallback(() => {
    stopAllSources();
    setPlaying(false);
  }, [stopAllSources]);

  const stop = useCallback(() => {
    stopAllSources();
    setPlaying(false);
    setPlayhead(0);
  }, [setPlayhead, stopAllSources]);

  const seek = useCallback(
    (t: number) => {
      setPlayhead(t);
      if (playing && clips.length > 0) {
        scheduleFrom(t);
      }
    },
    [clips.length, playing, scheduleFrom, setPlayhead],
  );

  // Drive the visual playhead from the audio clock while playing.
  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      return;
    }
    const ctx = ctxRef.current;
    const tick = () => {
      if (ctx && clips.length > 0) {
        const elapsed = ctx.currentTime - startedAtCtxRef.current;
        const head = Math.max(0, startedAtHeadRef.current + elapsed);
        const cap = totalDuration > 0 ? totalDuration : TOTAL_SECONDS;
        if (head >= cap) {
          stopAllSources();
          setPlaying(false);
          setPlayhead(cap);
          return;
        }
        setPlayhead(head);
      } else {
        // Fallback visual-only tick at ~60fps (no audio loaded)
        setPlayhead(
          Math.min(TOTAL_SECONDS, (startedAtHeadRef.current += 1 / 60)),
        );
        if (startedAtHeadRef.current >= TOTAL_SECONDS) {
          setPlaying(false);
          return;
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    if (clips.length === 0) {
      // Seed the visual cursor from current playhead
      startedAtHeadRef.current = playhead;
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, clips.length, totalDuration]);

  // Mute toggle
  useEffect(() => {
    if (masterGainRef.current) {
      masterGainRef.current.gain.value = muted ? 0 : 1;
    }
  }, [muted]);

  // Tear down on unmount
  useEffect(() => {
    return () => {
      stopAllSources();
      ctxRef.current?.close().catch(() => undefined);
    };
  }, [stopAllSources]);

  return {
    play,
    pause,
    stop,
    seek,
    playing,
    muted,
    toggleMute: () => setMuted((m) => !m),
    loading,
    loadErr,
    hasAudio: clips.length > 0,
    audioDuration: totalDuration,
  };
}

function AssemblyWorkspace() {
  const { focus } = Route.useSearch();
  useFocusHandoff(focus, {
    "intention-pin": "your intention",
    sources: "the track headers",
    transitions: "the timeline",
    copilot: "the transport",
  });
  const [tracks, setTracks] = useState<Track[]>(initialTracks);
  const [playhead, setPlayhead] = useState(0);
  const [bpm, setBpm] = useState(124);
  const [pxPerSec, setPxPerSec] = useState(14);
  const [snap, setSnap] = useState(true);
  const [debugOpen, setDebugOpen] = useState(true);
  const lanesScrollRef = useRef<HTMLDivElement>(null);

  const engine = useSetAudioEngine(playhead, setPlayhead);

  // Surface load errors once.
  useEffect(() => {
    if (engine.loadErr) toast.error(`Audio: ${engine.loadErr}`);
  }, [engine.loadErr]);

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
    engine.seek(t);
  };

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Top transport bar */}
      <TransportBar
        playing={engine.playing}
        onPlayToggle={() => (engine.playing ? engine.pause() : engine.play())}
        onStop={engine.stop}
        onSkipBack={() => engine.seek(0)}
        onSkipForward={() =>
          engine.seek(engine.audioDuration > 0 ? engine.audioDuration : TOTAL_SECONDS)
        }
        playhead={playhead}
        bpm={bpm}
        setBpm={setBpm}
        pxPerSec={pxPerSec}
        setPxPerSec={setPxPerSec}
        snap={snap}
        setSnap={setSnap}
        muted={engine.muted}
        onToggleMute={engine.toggleMute}
        hasAudio={engine.hasAudio}
        loading={engine.loading}
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

      {/* Debug HUD */}
      {debugOpen ? (
        <DebugHUD
          state={{
            playing: engine.playing,
            playhead,
            hasAudio: engine.hasAudio,
            audioDuration: engine.audioDuration,
            loading: engine.loading,
            loadErr: engine.loadErr,
            muted: engine.muted,
          }}
          onForcePlay={() => {
            console.log("[debug] force play");
            engine.play();
          }}
          onForcePause={() => {
            console.log("[debug] force pause");
            engine.pause();
          }}
          onClose={() => setDebugOpen(false)}
        />
      ) : (
        <button
          onClick={() => setDebugOpen(true)}
          className="absolute left-4 bottom-4 z-40 flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur hover:border-primary hover:text-primary"
          aria-label="Open debug"
          title="Debug"
        >
          <Bug className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

/* ---------------- Debug HUD ---------------- */

function DebugHUD({
  state,
  onForcePlay,
  onForcePause,
  onClose,
}: {
  state: {
    playing: boolean;
    playhead: number;
    hasAudio: boolean;
    audioDuration: number;
    loading: boolean;
    loadErr: string | null;
    muted: boolean;
  };
  onForcePlay: () => void;
  onForcePause: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-4 bottom-4 z-40 w-[320px] rounded-lg border border-border bg-card/95 p-3 font-mono text-[11px] shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <Bug className="h-3.5 w-3.5" />
          <span className="uppercase tracking-[0.18em]">Engine debug</span>
        </div>
        <button
          onClick={onClose}
          className="text-muted-foreground hover:text-foreground"
          aria-label="Close debug"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      <div className="space-y-0.5 text-foreground/90">
        <Row k="playing" v={String(state.playing)} />
        <Row k="playhead" v={state.playhead.toFixed(2) + "s"} />
        <Row k="hasAudio" v={String(state.hasAudio)} />
        <Row k="audioDuration" v={state.audioDuration.toFixed(2) + "s"} />
        <Row k="loading" v={String(state.loading)} />
        <Row k="muted" v={String(state.muted)} />
        <Row k="loadErr" v={state.loadErr ?? "—"} />
      </div>
      <div className="mt-2 flex gap-1.5">
        <button
          onClick={onForcePlay}
          className="flex-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider hover:border-primary hover:text-primary"
        >
          Force play
        </button>
        <button
          onClick={onForcePause}
          className="flex-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] uppercase tracking-wider hover:border-primary hover:text-primary"
        >
          Force pause
        </button>
      </div>
      {!state.hasAudio ? (
        <div className="mt-2 rounded border border-border bg-background/60 p-2 text-[10px] leading-relaxed text-muted-foreground">
          No tracks decoded for today's set. The transport is in
          <span className="text-foreground"> visual-only </span> mode — Pause
          will toggle the playhead animation but no sound will play. Add tracks
          to your set in the Beatmaker / Library, then refresh.
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="truncate text-right">{v}</span>
    </div>
  );
}

/* ---------------- Transport ---------------- */

function TransportBar(props: {
  playing: boolean;
  onPlayToggle: () => void;
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
  muted: boolean;
  onToggleMute: () => void;
  hasAudio: boolean;
  loading: boolean;
}) {
  const {
    playing,
    onPlayToggle,
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
    muted,
    onToggleMute,
    hasAudio,
    loading,
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
        <Btn
          label={playing ? "Pause" : "Play"}
          onClick={onPlayToggle}
          active={playing}
        >
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Btn>
        <Btn label="Stop" onClick={onStop}>
          <Square className="h-4 w-4" />
        </Btn>
        <Btn label="Skip to end" onClick={onSkipForward}>
          <SkipForward className="h-4 w-4" />
        </Btn>
        <Btn label="Record" onClick={() => {}} danger>
          <Circle className="h-4 w-4" />
        </Btn>
        <Btn
          label={muted ? "Unmute" : "Mute"}
          onClick={onToggleMute}
          active={muted}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Btn>
      </div>

      <div className="ml-2 flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 font-mono text-sm tabular-nums">
        <span className="text-primary">{fmtTime(playhead)}</span>
        <span className="text-muted-foreground/50">/</span>
        <span className="text-muted-foreground">{fmtTime(TOTAL_SECONDS)}</span>
      </div>

      <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        {loading
          ? "Loading audio…"
          : hasAudio
            ? "Live audio"
            : "Visual only — add tracks to your set to hear playback"}
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

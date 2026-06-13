import { computeTimeline, CROSSFADE_SEC } from "@/utils/render";

/**
 * Time. To. Play. — the live engine.
 *
 * Plays the set as one continuous breath. Each track is fetched + DECODED to
 * an AudioBuffer and played through an AudioBufferSourceNode → per-track
 * GainNode → master. Decoding (rather than streaming an <audio> element
 * through MediaElementSource) is deliberate: a cross-origin element routed
 * through createMediaElementSource is muted to silence by the browser when
 * the host lacks CORS headers — which is exactly the "no real audio" failure
 * on imported tracks. Decoded buffers play the actual samples regardless of
 * origin, and use the same decode path as the export so what you hear is what
 * you ship. Timeline math is shared with the offline render (computeTimeline).
 *
 * Memory: decoding N full tracks costs ~N×(minutes×10MB). We decode lazily —
 * the current + next track only — so a long set never holds more than two
 * buffers at once.
 */

export type PlayerTrack = {
  id: string;
  title: string;
  artist: string | null;
  url: string;
};

export type PlayerSnapshot = {
  playing: boolean;
  elapsed: number;
  total: number;
  currentIndex: number;
  ready: boolean;
  ended: boolean;
};

export type LivePlayerEvents = {
  onSnapshot?: (s: PlayerSnapshot) => void;
  /** Fires the moment a blend starts: (fromIndex, toIndex). */
  onTransition?: (from: number, to: number) => void;
  onEnded?: () => void;
  onStall?: () => void;
  onError?: (message: string) => void;
};

/** Equal-power crossfade gain curves (cos/sin) for setValueCurveAtTime. */
const STEPS = 48;
function curve(rising: boolean): Float32Array {
  const c = new Float32Array(STEPS);
  for (let i = 0; i < STEPS; i++) {
    const x = i / (STEPS - 1);
    c[i] = rising ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
  }
  return c;
}
const RISE = curve(true);
const FALL = curve(false);

type Voice = { src: AudioBufferSourceNode; gain: GainNode; startedAt: number };

export class LivePlayer {
  private tracks: PlayerTrack[];
  private events: LivePlayerEvents;
  private fade = CROSSFADE_SEC;

  private ctx: AudioContext | null = null;
  private buffers: (AudioBuffer | null)[] = [];
  private decoding = new Map<number, Promise<AudioBuffer | null>>();
  private durations: number[] = [];
  private starts: number[] = [];
  private total = 0;
  /** Per-boundary crossfade lengths (boundary i = between track i and i+1). */
  private fades: number[] = [];

  private voices = new Map<number, Voice>();
  private currentIndex = 0;
  /** Audio-clock time at which the current track's playhead was at offsetInTrack. */
  private anchorCtxTime = 0;
  private anchorOffset = 0;
  private blendStartedFor = new Set<number>();

  private playing = false;
  private ready = false;
  private ended = false;
  private ticker: ReturnType<typeof setInterval> | null = null;
  private disposed = false;

  constructor(tracks: PlayerTrack[], events: LivePlayerEvents = {}) {
    this.tracks = tracks;
    this.events = events;
  }

  private ac(): AudioContext {
    if (!this.ctx) {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctx();
    }
    return this.ctx;
  }

  /** Fetch + decode one track (cached, deduped). Returns null on failure. */
  private decode(idx: number): Promise<AudioBuffer | null> {
    if (this.buffers[idx]) return Promise.resolve(this.buffers[idx]);
    const existing = this.decoding.get(idx);
    if (existing) return existing;
    const t = this.tracks[idx];
    const p = (async () => {
      try {
        const resp = await fetch(t.url);
        if (!resp.ok) throw new Error(`fetch ${resp.status}`);
        const arr = await resp.arrayBuffer();
        const buf = await this.ac().decodeAudioData(arr);
        this.buffers[idx] = buf;
        return buf;
      } catch (e) {
        console.warn("[live-player] decode failed", t.url, e);
        this.events.onError?.(e instanceof Error ? e.message : "decode failed");
        return null;
      } finally {
        this.decoding.delete(idx);
      }
    })();
    this.decoding.set(idx, p);
    return p;
  }

  /**
   * Size the timeline. We decode track 0 + 1 for real durations and estimate
   * the rest from metadata; durations refine as tracks decode, but the bar is
   * usable immediately.
   */
  async load(): Promise<void> {
    // Quick metadata pass for durations (cheap, no full decode).
    const metas = await Promise.all(
      this.tracks.map(
        (t) =>
          new Promise<number>((resolve) => {
            const el = new Audio();
            el.preload = "metadata";
            if (/^https?:/.test(t.url) && !t.url.startsWith(window.location.origin)) {
              el.crossOrigin = "anonymous";
            }
            const done = (d: number) => resolve(Number.isFinite(d) && d > 0 ? d : 180);
            el.addEventListener("loadedmetadata", () => done(el.duration), { once: true });
            el.addEventListener("error", () => done(180), { once: true });
            setTimeout(() => done(el.duration), 6000);
            el.src = t.url;
          }),
      ),
    );
    if (this.disposed) return;
    this.durations = metas;
    this.recomputeTimeline();
    this.ready = true;
    this.emit();
    // Warm the first track so the first Play is instant.
    void this.decode(0);
  }

  private fadeFor(boundary: number): number {
    const f = this.fades[boundary];
    return f === undefined || f === null ? this.fade : Math.max(0.05, f);
  }

  private recomputeTimeline(): void {
    const fadesArr = this.tracks.map((_, i) => this.fadeFor(i));
    const tl = computeTimeline(this.durations, fadesArr);
    this.starts = tl.starts;
    this.total = tl.total;
  }

  /** Set per-boundary crossfade lengths (seconds). Recomputes the timeline. */
  setFades(fades: number[]): void {
    this.fades = fades.slice();
    if (this.durations.length) {
      this.recomputeTimeline();
      this.emit();
    }
  }

  getDurations(): number[] {
    return [...this.durations];
  }

  /** Timeline for the lanes: where each track sits and the set length. */
  getTimeline(): { starts: number[]; durations: number[]; total: number } {
    return { starts: [...this.starts], durations: [...this.durations], total: this.total };
  }

  /** Start (or resume) playback of `idx` at `offset` seconds into the track. */
  private async startVoice(idx: number, offset: number, fadeIn: boolean): Promise<void> {
    const ctx = this.ac();
    const buf = await this.decode(idx);
    if (!buf || this.disposed) return;

    // Correct the duration from the decoded buffer (metadata can be wrong).
    if (Math.abs((this.durations[idx] ?? 0) - buf.duration) > 0.3) {
      this.durations[idx] = buf.duration;
      this.recomputeTimeline();
    }

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const gain = ctx.createGain();
    src.connect(gain).connect(ctx.destination);

    const now = ctx.currentTime;
    if (fadeIn) {
      gain.gain.setValueAtTime(0, now);
      gain.gain.setValueCurveAtTime(RISE, now, this.fade);
    } else {
      gain.gain.setValueAtTime(1, now);
    }
    src.start(now, Math.max(0, Math.min(offset, buf.duration - 0.05)));
    this.voices.set(idx, { src, gain, startedAt: now });

    if (idx === this.currentIndex) {
      this.anchorCtxTime = now;
      this.anchorOffset = offset;
    }
  }

  async play(): Promise<void> {
    if (this.disposed || this.ended) return;
    const ctx = this.ac();
    await ctx.resume();
    if (this.playing) return;

    if (this.voices.size === 0) {
      // Fresh start (or resume after a full stop) at the current position.
      if (!this.buffers[this.currentIndex]) this.events.onStall?.();
      await this.startVoice(this.currentIndex, this.anchorOffset, false);
    }
    this.playing = true;
    this.startTicker();
    this.emit();
    // Pre-decode the next track so the blend never stalls.
    if (this.currentIndex + 1 < this.tracks.length) void this.decode(this.currentIndex + 1);
  }

  pause(): void {
    if (!this.playing) return;
    // Capture the current playhead, then tear the voices down (buffer sources
    // can't be paused — we restart at the captured offset on resume).
    this.anchorOffset = this.currentOffset();
    this.stopAllVoices();
    this.playing = false;
    this.stopTicker();
    this.emit();
  }

  private currentOffset(): number {
    if (!this.ctx) return this.anchorOffset;
    return this.anchorOffset + (this.ctx.currentTime - this.anchorCtxTime);
  }

  private stopAllVoices(): void {
    this.voices.forEach((v) => {
      try {
        v.src.stop();
      } catch {
        /* already stopped */
      }
      v.src.disconnect();
      v.gain.disconnect();
    });
    this.voices.clear();
    this.blendStartedFor.clear();
  }

  dispose(): void {
    this.disposed = true;
    this.stopTicker();
    this.stopAllVoices();
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
    this.buffers = [];
  }

  private startTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), 100);
  }
  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private tick(): void {
    if (!this.playing || this.disposed || !this.ctx) return;
    const i = this.currentIndex;
    const dur = this.durations[i] || 0;
    const offset = this.currentOffset();
    const remaining = dur - offset;
    const fade = this.fadeFor(i);

    if (i + 1 < this.tracks.length && remaining < fade * 2) {
      void this.decode(i + 1);
    }

    if (i + 1 < this.tracks.length && remaining <= fade && !this.blendStartedFor.has(i)) {
      this.blendStartedFor.add(i);
      void this.beginBlend(i, Math.max(0.2, Math.min(fade, remaining)));
    }

    if (i === this.tracks.length - 1 && offset >= dur - 0.05) {
      this.playing = false;
      this.ended = true;
      this.stopAllVoices();
      this.stopTicker();
      this.emit();
      this.events.onEnded?.();
      return;
    }
    this.emit();
  }

  private async beginBlend(from: number, fadeSec: number): Promise<void> {
    const ctx = this.ac();
    const fromVoice = this.voices.get(from);
    // Fade the outgoing track out.
    if (fromVoice) {
      const now = ctx.currentTime;
      try {
        fromVoice.gain.gain.cancelScheduledValues(now);
        fromVoice.gain.gain.setValueCurveAtTime(FALL, now, fadeSec);
      } catch {
        fromVoice.gain.gain.linearRampToValueAtTime(0, now + fadeSec);
      }
      const v = fromVoice;
      setTimeout(
        () => {
          try {
            v.src.stop();
          } catch {
            /* noop */
          }
          v.src.disconnect();
          v.gain.disconnect();
          this.voices.delete(from);
        },
        (fadeSec + 0.2) * 1000,
      );
    }
    // Advance current → incoming, start it fading in from its head.
    this.currentIndex = from + 1;
    await this.startVoice(from + 1, 0, true);
    this.events.onTransition?.(from, from + 1);
    if (this.currentIndex + 1 < this.tracks.length) void this.decode(this.currentIndex + 1);
    this.emit();
  }

  private emit(): void {
    if (!this.events.onSnapshot) return;
    const i = this.currentIndex;
    const elapsed = this.ended ? this.total : (this.starts[i] ?? 0) + this.currentOffset();
    this.events.onSnapshot({
      playing: this.playing,
      elapsed: Math.max(0, Math.min(elapsed, this.total)),
      total: this.total,
      currentIndex: i,
      ready: this.ready,
      ended: this.ended,
    });
  }
}

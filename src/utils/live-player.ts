import { computeTimeline, CROSSFADE_SEC } from "@/utils/render";

/**
 * S3 live player — streams the set as one continuous breath.
 *
 * Architecture: HTMLAudioElements (streamed, so six full-length tracks cost
 * ~nothing in memory) routed through an AudioContext via
 * createMediaElementSource → per-track GainNode → destination. When the
 * playing track is CROSSFADE_SEC from its end, the next one starts and the
 * two gains ramp along equal-power curves. Timeline math is shared with the
 * offline render (computeTimeline) so the progress bar and the export agree.
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

const EQUAL_POWER_STEPS = 32;

function equalPowerCurve(rising: boolean): Float32Array {
  const curve = new Float32Array(EQUAL_POWER_STEPS);
  for (let i = 0; i < EQUAL_POWER_STEPS; i++) {
    const x = i / (EQUAL_POWER_STEPS - 1);
    curve[i] = rising ? Math.sin((x * Math.PI) / 2) : Math.cos((x * Math.PI) / 2);
  }
  return curve;
}

const RISE = equalPowerCurve(true);
const FALL = equalPowerCurve(false);

export class LivePlayer {
  private tracks: PlayerTrack[];
  private events: LivePlayerEvents;
  private fade = CROSSFADE_SEC;

  private ctx: AudioContext | null = null;
  private elements: (HTMLAudioElement | null)[] = [];
  private gains: (GainNode | null)[] = [];
  private durations: number[] = [];
  private starts: number[] = [];
  private total = 0;

  private currentIndex = 0;
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

  /** Preload metadata for every track to size the timeline. */
  async load(): Promise<void> {
    const metas = await Promise.all(
      this.tracks.map(
        (t) =>
          new Promise<number>((resolve) => {
            const el = this.makeElement(t);
            const done = (d: number) => resolve(Number.isFinite(d) && d > 0 ? d : 180);
            el.addEventListener("loadedmetadata", () => done(el.duration), { once: true });
            el.addEventListener("error", () => done(180), { once: true });
            // Safety: some blob/m4a combos never fire either event.
            setTimeout(() => done(el.duration), 8000);
          }),
      ),
    );
    if (this.disposed) return;
    this.durations = metas;
    const tl = computeTimeline(this.durations, this.fade);
    this.starts = tl.starts;
    this.total = tl.total;
    this.ready = true;
    this.emit();
  }

  /** Reported duration for a track once metadata is in (for backfilling the DB). */
  getDurations(): number[] {
    return [...this.durations];
  }

  private makeElement(t: PlayerTrack): HTMLAudioElement {
    const idx = this.tracks.indexOf(t);
    const existing = this.elements[idx];
    if (existing) return existing;
    const el = new Audio();
    // Remote (Supabase) URLs need CORS for MediaElementSource; same-origin
    // and blob: URLs don't care about the attribute.
    if (/^https?:/.test(t.url) && !t.url.startsWith(window.location.origin)) {
      el.crossOrigin = "anonymous";
    }
    el.preload = "metadata";
    el.src = t.url;
    el.addEventListener("waiting", () => {
      if (this.playing) this.events.onStall?.();
    });
    this.elements[idx] = el;
    return el;
  }

  private ensureGraph(idx: number): { el: HTMLAudioElement; gain: GainNode } {
    if (!this.ctx) this.ctx = new AudioContext();
    const el = this.makeElement(this.tracks[idx]);
    let gain = this.gains[idx];
    if (!gain) {
      gain = this.ctx.createGain();
      const src = this.ctx.createMediaElementSource(el);
      src.connect(gain).connect(this.ctx.destination);
      this.gains[idx] = gain;
    }
    return { el, gain };
  }

  async play(): Promise<void> {
    if (this.disposed || this.ended) return;
    const { el, gain } = this.ensureGraph(this.currentIndex);
    await this.ctx!.resume();
    if (!this.blendInProgress()) gain.gain.value = 1;
    try {
      await el.play();
      // If we paused mid-blend, the previous track needs to resume too.
      const prev = this.currentIndex - 1;
      if (this.blendStartedFor.has(prev) && this.elements[prev] && !this.elements[prev]!.ended) {
        await this.elements[prev]!.play().catch(() => undefined);
      }
    } catch (e) {
      this.events.onError?.(e instanceof Error ? e.message : "playback failed");
      return;
    }
    this.playing = true;
    this.startTicker();
    this.emit();
  }

  pause(): void {
    this.playing = false;
    this.elements.forEach((el) => el?.pause());
    this.stopTicker();
    this.emit();
  }

  dispose(): void {
    this.disposed = true;
    this.stopTicker();
    this.elements.forEach((el) => {
      if (el) {
        el.pause();
        el.removeAttribute("src");
        el.load();
      }
    });
    this.elements = [];
    this.gains = [];
    void this.ctx?.close().catch(() => undefined);
    this.ctx = null;
  }

  private blendInProgress(): boolean {
    const prev = this.currentIndex - 1;
    const prevEl = this.elements[prev];
    return this.blendStartedFor.has(prev) && !!prevEl && !prevEl.ended && !prevEl.paused;
  }

  private startTicker(): void {
    if (this.ticker) return;
    this.ticker = setInterval(() => this.tick(), 120);
  }

  private stopTicker(): void {
    if (this.ticker) {
      clearInterval(this.ticker);
      this.ticker = null;
    }
  }

  private tick(): void {
    if (!this.playing || this.disposed) return;
    const i = this.currentIndex;
    const el = this.elements[i];
    if (!el) return;

    const dur = this.durations[i] || el.duration || 0;
    const remaining = dur - el.currentTime;

    // Preload the one after next early so blends never buffer.
    if (i + 1 < this.tracks.length && remaining < this.fade * 2) {
      this.ensureGraph(i + 1).el.load();
    }

    // Start the blend.
    if (i + 1 < this.tracks.length && remaining <= this.fade && !this.blendStartedFor.has(i)) {
      this.blendStartedFor.add(i);
      void this.startBlend(i, Math.max(0.4, remaining));
    }

    // Last track finished?
    if (i === this.tracks.length - 1 && el.ended) {
      this.playing = false;
      this.ended = true;
      this.stopTicker();
      this.emit();
      this.events.onEnded?.();
      return;
    }

    this.emit();
  }

  private async startBlend(from: number, fadeSec: number): Promise<void> {
    const ctx = this.ctx!;
    const { gain: fromGain } = this.ensureGraph(from);
    const { el: toEl, gain: toGain } = this.ensureGraph(from + 1);

    toGain.gain.value = 0;
    try {
      await toEl.play();
    } catch (e) {
      this.events.onError?.(e instanceof Error ? e.message : "blend failed");
      return;
    }

    const now = ctx.currentTime;
    try {
      fromGain.gain.cancelScheduledValues(now);
      toGain.gain.cancelScheduledValues(now);
      fromGain.gain.setValueCurveAtTime(FALL, now, fadeSec);
      toGain.gain.setValueCurveAtTime(RISE, now, fadeSec);
    } catch {
      // Overlapping curves can throw on rapid re-entry — fall back to ramps.
      fromGain.gain.linearRampToValueAtTime(0, now + fadeSec);
      toGain.gain.linearRampToValueAtTime(1, now + fadeSec);
    }

    this.currentIndex = from + 1;
    this.events.onTransition?.(from, from + 1);
    this.emit();
  }

  private emit(): void {
    if (!this.events.onSnapshot) return;
    const i = this.currentIndex;
    const el = this.elements[i];
    const elapsed = this.ended ? this.total : (this.starts[i] ?? 0) + (el?.currentTime ?? 0);
    this.events.onSnapshot({
      playing: this.playing,
      elapsed: Math.min(elapsed, this.total),
      total: this.total,
      currentIndex: i,
      ready: this.ready,
      ended: this.ended,
    });
  }
}

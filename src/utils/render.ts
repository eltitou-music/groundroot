import { supabase } from "@/integrations/supabase/client";
import { floatToWavBlob } from "@/utils/share";

/**
 * Real Assembly stitcher.
 *
 * Pulls every playable track for a set, decodes each one, and renders them
 * into a single mastered stereo buffer using an OfflineAudioContext. Tracks
 * are joined with short equal-power crossfades and the global Mastery
 * controls (EQ shelves, stereo width, glue compressor, loudness gain) are
 * applied on the bus before render. Falls back to `null` when the set has
 * no decodable audio so the caller can decide whether to use the placeholder
 * synth instead.
 */

export type MasterSettings = {
  lufs: number;   // -24..-6, used as a rough output gain target
  low: number;    // dB, low-shelf @ 120Hz
  mid: number;    // dB, peaking @ 1kHz
  high: number;   // dB, high-shelf @ 6kHz
  width: number;  // 0..100, mid/side width
  glue: number;   // 0..100, compressor amount
};

const SR = 44100;
const CROSSFADE_SEC = 2;

/** Pull every track on the set that has a playable upload_url, in arrangement order. */
export async function loadSetAudioSources(setId: string): Promise<{ url: string; title: string }[]> {
  const { data, error } = await supabase
    .from("tracks")
    .select("title, upload_url, position")
    .eq("set_id", setId)
    .order("position", { ascending: true });
  if (error) throw error;
  return (data ?? [])
    .filter((t) => !!t.upload_url)
    .map((t) => ({ url: t.upload_url as string, title: t.title }));
}

/** Fetch + decode a single audio URL into an AudioBuffer at the target sample rate. */
async function decodeUrl(ctx: OfflineAudioContext | AudioContext, url: string): Promise<AudioBuffer | null> {
  try {
    const resp = await fetch(url);
    if (!resp.ok) return null;
    const buf = await resp.arrayBuffer();
    return await ctx.decodeAudioData(buf);
  } catch (e) {
    console.warn("[render] decode failed", url, e);
    return null;
  }
}

/** dB → linear gain. */
const db = (n: number) => Math.pow(10, n / 20);

/**
 * Build the master bus inside the offline context: source(s) → EQ → width → glue → makeup.
 * Returns the input node sources should be connected to.
 */
function buildMasterBus(ctx: OfflineAudioContext, settings: MasterSettings): AudioNode {
  const input = ctx.createGain();
  input.gain.value = 1;

  // 3-band EQ
  const lowShelf = ctx.createBiquadFilter();
  lowShelf.type = "lowshelf";
  lowShelf.frequency.value = 120;
  lowShelf.gain.value = settings.low;

  const midPeak = ctx.createBiquadFilter();
  midPeak.type = "peaking";
  midPeak.frequency.value = 1000;
  midPeak.Q.value = 0.9;
  midPeak.gain.value = settings.mid;

  const highShelf = ctx.createBiquadFilter();
  highShelf.type = "highshelf";
  highShelf.frequency.value = 6000;
  highShelf.gain.value = settings.high;

  input.connect(lowShelf).connect(midPeak).connect(highShelf);

  // Stereo width via mid/side reconstruction
  // width 50 → neutral; <50 narrow, >50 wide
  const widthNorm = (settings.width - 50) / 50; // -1..1
  const splitter = ctx.createChannelSplitter(2);
  const merger = ctx.createChannelMerger(2);
  highShelf.connect(splitter);

  // L' = L*(1 + w*0.5) - R*(w*0.5); R' = R*(1 + w*0.5) - L*(w*0.5)
  const lToL = ctx.createGain(); lToL.gain.value = 1 + widthNorm * 0.5;
  const rToR = ctx.createGain(); rToR.gain.value = 1 + widthNorm * 0.5;
  const rToLNeg = ctx.createGain(); rToLNeg.gain.value = -widthNorm * 0.5;
  const lToRNeg = ctx.createGain(); lToRNeg.gain.value = -widthNorm * 0.5;

  splitter.connect(lToL, 0);
  splitter.connect(lToRNeg, 0);
  splitter.connect(rToR, 1);
  splitter.connect(rToLNeg, 1);
  lToL.connect(merger, 0, 0);
  rToLNeg.connect(merger, 0, 0);
  rToR.connect(merger, 0, 1);
  lToRNeg.connect(merger, 0, 1);

  // Glue compressor
  const comp = ctx.createDynamicsCompressor();
  // Map glue 0..100 → threshold -8..-28 dB, ratio 1.5..4, knee soft
  comp.threshold.value = -8 - (settings.glue / 100) * 20;
  comp.knee.value = 24;
  comp.ratio.value = 1.5 + (settings.glue / 100) * 2.5;
  comp.attack.value = 0.02;
  comp.release.value = 0.25;
  merger.connect(comp);

  // Loudness makeup. Target LUFS is approximated as a relative gain vs -14 LUFS
  // (streaming reference). Cap at +9 dB to avoid catastrophic clipping; final
  // PCM conversion will hard-clip safely.
  const makeup = ctx.createGain();
  const targetGainDb = Math.max(-12, Math.min(9, -14 - settings.lufs));
  makeup.gain.value = db(targetGainDb);
  comp.connect(makeup);
  makeup.connect(ctx.destination);

  return input;
}

/** Place a decoded buffer onto the bus at `startAt` with equal-power fade in/out. */
function scheduleClip(
  ctx: OfflineAudioContext,
  bus: AudioNode,
  buf: AudioBuffer,
  startAt: number,
  fadeIn: number,
  fadeOut: number,
) {
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const g = ctx.createGain();
  const dur = buf.duration;

  const t0 = Math.max(0, startAt);
  // Equal-power fade approximation using exponential ramps.
  g.gain.setValueAtTime(fadeIn > 0 ? 0.0001 : 1, t0);
  if (fadeIn > 0) {
    g.gain.exponentialRampToValueAtTime(1, t0 + fadeIn);
  }
  if (fadeOut > 0) {
    const fadeStart = t0 + Math.max(fadeIn, dur - fadeOut);
    g.gain.setValueAtTime(1, fadeStart);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  src.connect(g).connect(bus);
  src.start(t0);
  src.stop(t0 + dur + 0.05);
}

/**
 * Render the set into a stereo WAV blob. Returns null if no decodable
 * sources are available (caller should fall back to the synth preview).
 */
export async function renderSetMaster(
  setId: string,
  settings: MasterSettings,
  onProgress?: (msg: string) => void,
): Promise<Blob | null> {
  const sources = await loadSetAudioSources(setId);
  if (sources.length === 0) return null;

  // Decode in a temporary online context first — OfflineAudioContext also
  // supports decodeAudioData but we need durations to size the offline ctx.
  onProgress?.("Decoding tracks…");
  const Ctx: typeof AudioContext =
    (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext);
  const tmp = new Ctx();
  const decoded: AudioBuffer[] = [];
  for (const s of sources) {
    const buf = await decodeUrl(tmp, s.url);
    if (buf) decoded.push(buf);
  }
  await tmp.close().catch(() => undefined);

  if (decoded.length === 0) return null;

  // Compute timeline with crossfades
  const fade = CROSSFADE_SEC;
  const starts: number[] = [];
  let cursor = 0;
  for (let i = 0; i < decoded.length; i++) {
    starts.push(cursor);
    const dur = decoded[i].duration;
    const advance = i === decoded.length - 1 ? dur : Math.max(0.5, dur - fade);
    cursor += advance;
  }
  const totalDur = cursor + 0.25; // small tail

  onProgress?.("Rendering master…");
  const offline = new OfflineAudioContext({
    numberOfChannels: 2,
    length: Math.ceil(totalDur * SR),
    sampleRate: SR,
  });
  const bus = buildMasterBus(offline, settings);

  for (let i = 0; i < decoded.length; i++) {
    const fadeIn = i === 0 ? 0 : fade;
    const fadeOut = i === decoded.length - 1 ? 0 : fade;
    scheduleClip(offline, bus, decoded[i], starts[i], fadeIn, fadeOut);
  }

  const rendered = await offline.startRendering();
  return audioBufferToWav(rendered);
}

/** Encode a stereo (or mono) AudioBuffer into a 16-bit PCM WAV Blob. */
export function audioBufferToWav(buf: AudioBuffer): Blob {
  const channels = Math.min(2, buf.numberOfChannels);
  const sr = buf.sampleRate;

  if (channels === 1) {
    return floatToWavBlob(buf.getChannelData(0), sr);
  }

  const left = buf.getChannelData(0);
  const right = buf.getChannelData(1);
  const numSamples = left.length;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const byteRate = sr * blockAlign;
  const dataSize = numSamples * blockAlign;

  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, channels, true);
  view.setUint32(24, sr, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const l = Math.max(-1, Math.min(1, left[i]));
    const r = Math.max(-1, Math.min(1, right[i]));
    view.setInt16(offset, l < 0 ? l * 0x8000 : l * 0x7fff, true); offset += 2;
    view.setInt16(offset, r < 0 ? r * 0x8000 : r * 0x7fff, true); offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}
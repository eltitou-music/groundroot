/**
 * In-browser mp3 encoding via @breezystack/lamejs (a maintained lamejs fork;
 * the original npm release ships broken). Dynamically imported so the encoder
 * never weighs down the main bundle. Falls back to WAV at the call site.
 */

const BITRATE_KBPS = 192;
const FRAME = 1152; // lamejs sample-block size

function toInt16(samples: Float32Array): Int16Array {
  const out = new Int16Array(samples.length);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    out[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  return out;
}

/**
 * Encode an AudioBuffer to an mp3 Blob. Yields progress 0..1 via onProgress.
 * Throws on failure — the caller decides whether to fall back to WAV.
 */
export async function encodeMp3(
  buffer: AudioBuffer,
  onProgress?: (p: number) => void,
): Promise<Blob> {
  const { Mp3Encoder } = await import("@breezystack/lamejs");
  const channels = Math.min(2, buffer.numberOfChannels);
  const sampleRate = buffer.sampleRate;
  const encoder = new Mp3Encoder(channels, sampleRate, BITRATE_KBPS);

  const left = toInt16(buffer.getChannelData(0));
  const right = channels === 2 ? toInt16(buffer.getChannelData(1)) : left;

  const chunks: Uint8Array[] = [];
  const total = left.length;

  for (let i = 0; i < total; i += FRAME) {
    const l = left.subarray(i, i + FRAME);
    const r = right.subarray(i, i + FRAME);
    const block = channels === 2 ? encoder.encodeBuffer(l, r) : encoder.encodeBuffer(l);
    if (block.length > 0) chunks.push(new Uint8Array(block));
    if (onProgress && i % (FRAME * 64) === 0) {
      onProgress(i / total);
      // Let the UI paint between large blocks.
      await new Promise((r) => setTimeout(r, 0));
    }
  }
  const end = encoder.flush();
  if (end.length > 0) chunks.push(new Uint8Array(end));
  onProgress?.(1);

  return new Blob(chunks as BlobPart[], { type: "audio/mpeg" });
}

/** Trigger a browser download for any blob. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Filesystem-safe slug for a set title. */
export function filenameFor(title: string, ext: string): string {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "groundroot-set";
  return `${base}.${ext}`;
}

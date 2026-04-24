import { supabase } from "@/integrations/supabase/client";
import { ensureUserId } from "@/utils/today-set";

/**
 * Encode a Float32Array (-1..1, mono) as a 16-bit PCM WAV Blob.
 * Tiny + dependency-free — fine for the placeholder render until a real
 * Assembly stitch is wired in.
 */
export function floatToWavBlob(samples: Float32Array, sampleRate = 44100): Blob {
  const numSamples = samples.length;
  const bytesPerSample = 2;
  const blockAlign = bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const dataSize = numSamples * bytesPerSample;

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
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < numSamples; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Render a quick preview tone shaped by the mastery settings — placeholder until Assembly stitches real audio. */
export function synthesizePreviewWav(opts: {
  durationSec?: number;
  lufs: number;
  width: number;
  glue: number;
}): Blob {
  const sr = 44100;
  const dur = opts.durationSec ?? 12;
  const N = Math.floor(sr * dur);
  const out = new Float32Array(N);
  const gain = Math.pow(10, (opts.lufs + 14) / 20); // rough relative
  const widthScale = 0.5 + (opts.width / 100) * 0.6;
  const glueScale = 1 - (opts.glue / 100) * 0.18;
  for (let i = 0; i < N; i++) {
    const t = i / sr;
    const env = Math.sin(Math.PI * (t / dur)); // rise & fall
    const v =
      Math.sin(2 * Math.PI * 110 * t) * 0.4 +
      Math.sin(2 * Math.PI * 220 * t) * 0.25 +
      Math.sin(2 * Math.PI * 330 * t) * 0.12;
    out[i] = Math.max(-1, Math.min(1, v * env * widthScale * glueScale * gain));
  }
  return floatToWavBlob(out, sr);
}

export type PublishResult = {
  setId: string;
  shareUrl: string;
  wavUrl: string;
};

/**
 * Upload a WAV blob to the public `masters` bucket, register a `set_renders` row,
 * and flip the parent set to public so the share URL works for anyone.
 */
export async function publishMaster(setId: string, wav: Blob): Promise<PublishResult> {
  const uid = await ensureUserId();
  const path = `${uid}/${setId}-${Date.now()}.wav`;

  const { error: upErr } = await supabase.storage
    .from("masters")
    .upload(path, wav, { contentType: "audio/wav", upsert: true });
  if (upErr) throw upErr;

  const { data: pub } = supabase.storage.from("masters").getPublicUrl(path);
  const wavUrl = pub.publicUrl;

  const { error: rErr } = await supabase.from("set_renders").insert({
    set_id: setId,
    wav_url: wavUrl,
  });
  if (rErr) throw rErr;

  const { error: sErr } = await supabase
    .from("sets")
    .update({ is_public: true })
    .eq("id", setId);
  if (sErr) throw sErr;

  const shareUrl = `${window.location.origin}/share/${setId}`;
  return { setId, shareUrl, wavUrl };
}

/**
 * If the user has a "today's set" we use it; otherwise create a one-off set
 * scoped to this render so the share URL has somewhere to live.
 */
export async function ensureSetForRender(
  intention: string | undefined,
  dedicatedTo: string | undefined,
): Promise<string> {
  const uid = await ensureUserId();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from("sets")
    .select("id")
    .eq("user_id", uid)
    .gte("updated_at", since)
    .order("updated_at", { ascending: false })
    .limit(1);
  if (data && data.length > 0) return data[0].id;

  const { data: created, error } = await supabase
    .from("sets")
    .insert({
      user_id: uid,
      title: "Untitled set",
      intention: intention?.trim() || null,
      dedicated_to: dedicatedTo?.trim() || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return created.id;
}
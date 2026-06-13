#!/usr/bin/env node
/**
 * Dev placeholder generator for the demo crate.
 *
 * Writes three ~32s synth WAVs into public/demo-crate/ so the demo-crate
 * path is testable before the real rights-free files are dropped in.
 * Real files replace placeholders 1:1 by filename (mp3 preferred; the
 * loader falls back to the .wav names below).
 *
 * Usage: node scripts/gen-demo-crate.mjs [--force]
 */
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = join(here, "..", "public", "demo-crate");
mkdirSync(outDir, { recursive: true });

const SR = 44100;
const DUR = 32; // seconds — long enough for two 6s crossfades to be audible
const force = process.argv.includes("--force");

/** Specs loosely matching the manifest (tempo-close, distinct chords). */
const SPECS = [
  { file: "under-control.wav", bpm: 118, root: 110.0, chord: [1, 1.5, 2] },        // A minor-ish drone
  { file: "di-mi-quando.wav", bpm: 121, root: 130.81, chord: [1, 1.25, 1.5] },     // C major-ish
  { file: "promises-parralox-remix.wav", bpm: 124, root: 164.81, chord: [1, 1.2, 2] }, // E minor-ish
];

function synth({ bpm, root, chord }) {
  const n = SR * DUR;
  const out = new Float32Array(n);
  const beat = 60 / bpm;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    // Gentle global envelope so blends feel like music, not test tones.
    const env = Math.min(1, t / 2, (DUR - t) / 2);
    // Chord pad
    let v = 0;
    for (const ratio of chord) v += Math.sin(2 * Math.PI * root * ratio * t) * 0.16;
    // Soft "kick" thump on the beat + offbeat hat-ish noise for rhythm
    const tb = t % beat;
    if (tb < 0.09) v += Math.sin(2 * Math.PI * 55 * tb) * Math.exp(-tb * 40) * 0.8;
    const th = (t + beat / 2) % beat;
    if (th < 0.03) v += (Math.random() * 2 - 1) * Math.exp(-th * 160) * 0.12;
    out[i] = Math.max(-1, Math.min(1, v * env));
  }
  return out;
}

function wavBlobBytes(samples) {
  const dataSize = samples.length * 2;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20); // PCM
  buf.writeUInt16LE(1, 22); // mono
  buf.writeUInt32LE(SR, 24);
  buf.writeUInt32LE(SR * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    buf.writeInt16LE(s < 0 ? s * 0x8000 : s * 0x7fff, 44 + i * 2);
  }
  return buf;
}

for (const spec of SPECS) {
  const target = join(outDir, spec.file);
  const mp3Twin = target.replace(/\.wav$/, ".mp3");
  if (!force && (existsSync(target) || existsSync(mp3Twin))) {
    console.log(`skip ${spec.file} (already present)`);
    continue;
  }
  writeFileSync(target, wavBlobBytes(synth(spec)));
  console.log(`wrote ${target} (${DUR}s @ ${spec.bpm} BPM placeholder)`);
}
console.log("Demo crate ready. Drop real mp3 files alongside to replace placeholders.");

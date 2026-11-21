#!/usr/bin/env node
/**
 * Procedural audio factory for AFTERLIGHT.
 *
 * Every sound in the game is synthesised here from noise and oscillators, then
 * encoded to mono MP3. Nothing is sampled from third-party material, which keeps
 * the project's audio fully original and licence-free.
 *
 * Usage: npm run audio:build
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const OUT = join(ROOT, 'assets/audio');
const TMP = join(ROOT, '.audio-tmp');
const SR = 22050;

mkdirSync(OUT, { recursive: true });
mkdirSync(TMP, { recursive: true });

// ── DSP helpers ───────────────────────────────────────────────────────────
function rng(seed = 1234567) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const TAU = Math.PI * 2;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function makeBuffer(seconds) {
  return new Float32Array(Math.ceil(seconds * SR));
}

function add(buf, index, value) {
  if (index >= 0 && index < buf.length) buf[index] += value;
}

function mixInto(target, source, offsetSeconds = 0) {
  const offset = Math.floor(offsetSeconds * SR);
  for (let i = 0; i < source.length; i += 1) add(target, i + offset, source[i]);
}

function env(t, attack, decay, curve = 2) {
  if (t < 0) return 0;
  if (t < attack) return t / attack;
  return Math.pow(1 - clamp((t - attack) / Math.max(0.0001, decay), 0, 1), curve);
}

function lowpass(buf, cutoff, q = 1) {
  const dt = 1 / SR;
  const rc = 1 / (TAU * cutoff);
  const alpha = dt / (rc + dt);
  let y = 0;
  for (let i = 0; i < buf.length; i += 1) {
    y += alpha * (buf[i] - y);
    buf[i] = y;
  }
  void q;
  return buf;
}

function highpass(buf, cutoff) {
  const dt = 1 / SR;
  const rc = 1 / (TAU * cutoff);
  const alpha = rc / (rc + dt);
  let prevX = 0;
  let prevY = 0;
  for (let i = 0; i < buf.length; i += 1) {
    const x = buf[i];
    const y = alpha * (prevY + x - prevX);
    buf[i] = y;
    prevX = x;
    prevY = y;
  }
  return buf;
}

function bandpass(buf, low, high) {
  highpass(buf, low);
  lowpass(buf, high);
  return buf;
}

function softClip(buf, drive = 1.5) {
  for (let i = 0; i < buf.length; i += 1) buf[i] = Math.tanh(buf[i] * drive) / Math.tanh(drive);
  return buf;
}

function normalize(buf, peak = 0.86) {
  let max = 0;
  for (let i = 0; i < buf.length; i += 1) max = Math.max(max, Math.abs(buf[i]));
  if (max < 1e-6) return buf;
  const g = peak / max;
  for (let i = 0; i < buf.length; i += 1) buf[i] *= g;
  return buf;
}

function fadeEdges(buf, fadeSeconds = 0.008) {
  const n = Math.floor(fadeSeconds * SR);
  for (let i = 0; i < n && i < buf.length; i += 1) {
    const g = i / n;
    buf[i] *= g;
    buf[buf.length - 1 - i] *= g;
  }
  return buf;
}

/** Equal-power loop crossfade: tail is folded into the head. */
function makeSeamless(buf, fadeSeconds = 0.9) {
  const n = Math.floor(fadeSeconds * SR);
  const out = new Float32Array(buf.length - n);
  out.set(buf.subarray(0, out.length));
  for (let i = 0; i < n; i += 1) {
    const angle = (i / n) * (Math.PI / 2);
    const head = Math.sin(angle);
    const tail = Math.cos(angle);
    out[i] = buf[i] * head + buf[buf.length - n + i] * tail;
  }
  return out;
}

/** Cheap feedback reverb with two combs and a gentle lowpass. */
function reverb(buf, mix = 0.28, decay = 0.42) {
  const out = Float32Array.from(buf);
  const combs = [0.037, 0.051];
  for (const delay of combs) {
    const d = Math.floor(delay * SR);
    for (let i = d; i < out.length; i += 1) out[i] += out[i - d] * decay;
  }
  lowpass(out, 5200);
  for (let i = 0; i < buf.length; i += 1) out[i] = buf[i] * (1 - mix) + out[i] * mix;
  return out;
}

function writeWav(path, samples) {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i += 1) {
    const s = clamp(samples[i], -1, 1);
    data.writeInt16LE(Math.round(s * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(data.length, 40);
  writeFileSync(path, Buffer.concat([header, data]));
}

// ── Instrument helpers ────────────────────────────────────────────────────
function tone(samples, { start = 0, dur = 0.3, freq = 440, type = 'sine', gain = 0.3, sweep = 1, attack = 0.005 }) {
  const begin = Math.floor(start * SR);
  const length = Math.floor(dur * SR);
  for (let i = 0; i < length; i += 1) {
    const t = i / SR;
    const p = t / dur;
    const f = freq * Math.pow(sweep, p);
    let v;
    if (type === 'sine') v = Math.sin(TAU * f * t);
    else if (type === 'triangle') v = (2 / Math.PI) * Math.asin(Math.sin(TAU * f * t));
    else if (type === 'saw') v = 2 * ((f * t) % 1) - 1;
    else v = Math.sin(TAU * f * t) > 0 ? 1 : -1;
    samples[begin + i] += v * env(t, attack, dur) * gain;
  }
}

function noiseBurst(samples, { start = 0, dur = 0.2, gain = 0.4, seed = 1, filter = 'band', low = 300, high = 4000 }) {
  const begin = Math.floor(start * SR);
  const length = Math.floor(dur * SR);
  const rand = rng(seed);
  const tmp = new Float32Array(length);
  for (let i = 0; i < length; i += 1) tmp[i] = rand() * 2 - 1;
  if (filter === 'band') bandpass(tmp, low, high);
  else if (filter === 'low') lowpass(tmp, high);
  else if (filter === 'high') highpass(tmp, low);
  for (let i = 0; i < length; i += 1) {
    samples[begin + i] += tmp[i] * env(i / SR, 0.003, dur, 1.7) * gain;
  }
}

// ── Sound design ──────────────────────────────────────────────────────────
const SOUNDS = {};

SOUNDS.ui_tap = () => {
  const b = makeBuffer(0.11);
  tone(b, { dur: 0.09, freq: 880, sweep: 0.72, gain: 0.5, attack: 0.002 });
  tone(b, { dur: 0.05, freq: 1760, sweep: 1, gain: 0.14, attack: 0.001 });
  return fadeEdges(normalize(b, 0.5));
};

SOUNDS.ui_open = () => {
  const b = makeBuffer(0.32);
  tone(b, { dur: 0.26, freq: 520, sweep: 1.5, gain: 0.28, attack: 0.02 });
  tone(b, { start: 0.06, dur: 0.24, freq: 780, sweep: 1.25, gain: 0.18, attack: 0.02 });
  return fadeEdges(normalize(b, 0.5));
};

SOUNDS.ui_close = () => {
  const b = makeBuffer(0.3);
  tone(b, { dur: 0.26, freq: 700, sweep: 0.6, gain: 0.26, attack: 0.01 });
  tone(b, { start: 0.04, dur: 0.2, freq: 420, sweep: 0.7, gain: 0.16, attack: 0.01 });
  return fadeEdges(normalize(b, 0.45));
};

SOUNDS.ui_error = () => {
  const b = makeBuffer(0.34);
  tone(b, { dur: 0.16, freq: 160, type: 'square', gain: 0.16, attack: 0.005 });
  tone(b, { start: 0.17, dur: 0.14, freq: 120, type: 'square', gain: 0.14, attack: 0.005 });
  noiseBurst(b, { dur: 0.1, gain: 0.05, seed: 3, low: 200, high: 900 });
  return fadeEdges(softClip(normalize(b, 0.4), 1.2));
};

SOUNDS.chop = () => {
  const b = makeBuffer(0.42);
  tone(b, { dur: 0.2, freq: 110, sweep: 0.55, gain: 0.5, attack: 0.002 });
  noiseBurst(b, { dur: 0.16, gain: 0.34, seed: 11, low: 700, high: 2600 });
  noiseBurst(b, { start: 0.02, dur: 0.3, gain: 0.12, seed: 12, low: 200, high: 900 });
  return fadeEdges(softClip(normalize(b, 0.7), 1.05));
};

SOUNDS.mine = () => {
  const b = makeBuffer(0.46);
  tone(b, { dur: 0.18, freq: 78, sweep: 0.6, gain: 0.55, attack: 0.001 });
  noiseBurst(b, { dur: 0.24, gain: 0.4, seed: 21, low: 1500, high: 7000 });
  noiseBurst(b, { start: 0.03, dur: 0.26, gain: 0.16, seed: 22, low: 300, high: 1400 });
  return fadeEdges(softClip(normalize(b, 0.72), 1.1));
};

SOUNDS.pick = () => {
  const b = makeBuffer(0.2);
  noiseBurst(b, { dur: 0.14, gain: 0.34, seed: 31, low: 900, high: 3600 });
  tone(b, { dur: 0.1, freq: 420, sweep: 1.4, gain: 0.15, attack: 0.002 });
  return fadeEdges(normalize(b, 0.5));
};

SOUNDS.water = () => {
  const b = makeBuffer(0.85);
  noiseBurst(b, { dur: 0.6, gain: 0.3, seed: 41, low: 500, high: 2200 });
  for (let i = 0; i < 6; i += 1) {
    const start = 0.08 + i * 0.1;
    tone(b, { start, dur: 0.1, freq: 500 + i * 90, sweep: 1.5, gain: 0.08, attack: 0.004 });
  }
  return fadeEdges(normalize(b, 0.55));
};

SOUNDS.pickup = () => {
  const b = makeBuffer(0.24);
  tone(b, { dur: 0.1, freq: 660, sweep: 1.2, gain: 0.3, attack: 0.002 });
  tone(b, { start: 0.06, dur: 0.12, freq: 990, sweep: 1.1, gain: 0.24, attack: 0.002 });
  return fadeEdges(normalize(b, 0.5));
};

SOUNDS.craft = () => {
  const b = makeBuffer(0.55);
  for (let i = 0; i < 3; i += 1) {
    noiseBurst(b, { start: i * 0.12, dur: 0.08, gain: 0.24, seed: 51 + i, low: 800, high: 3000 });
    tone(b, { start: i * 0.12, dur: 0.07, freq: 300 + i * 40, sweep: 0.9, gain: 0.12, attack: 0.002 });
  }
  return fadeEdges(normalize(b, 0.55));
};

SOUNDS.craft_done = () => {
  const b = makeBuffer(1.1);
  const notes = [523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone(b, { start: i * 0.11, dur: 0.6, freq: f, gain: 0.2, attack: 0.01 });
    tone(b, { start: i * 0.11, dur: 0.4, freq: f * 2, gain: 0.07, attack: 0.01 });
  });
  return fadeEdges(normalize(reverb(b, 0.3, 0.35), 0.6));
};

SOUNDS.build = () => {
  const b = makeBuffer(0.9);
  tone(b, { dur: 0.22, freq: 92, sweep: 0.6, gain: 0.45, attack: 0.003 });
  noiseBurst(b, { dur: 0.2, gain: 0.2, seed: 61, low: 400, high: 1800 });
  tone(b, { start: 0.18, dur: 0.14, freq: 180, sweep: 0.85, gain: 0.24, attack: 0.002 });
  noiseBurst(b, { start: 0.18, dur: 0.24, gain: 0.22, seed: 62, low: 600, high: 2600 });
  tone(b, { start: 0.4, dur: 0.18, freq: 140, sweep: 0.8, gain: 0.2, attack: 0.002 });
  return fadeEdges(softClip(normalize(b, 0.7), 1.1));
};

SOUNDS.quest = () => {
  const b = makeBuffer(1.8);
  const notes = [392, 523.25, 659.25, 783.99, 1046.5];
  notes.forEach((f, i) => {
    tone(b, { start: i * 0.13, dur: 1.1, freq: f, gain: 0.18, attack: 0.015 });
    tone(b, { start: i * 0.13, dur: 0.7, freq: f * 1.5, gain: 0.05, attack: 0.02 });
  });
  return fadeEdges(normalize(reverb(b, 0.38, 0.45), 0.66));
};

SOUNDS.level_up = () => {
  const b = makeBuffer(2.2);
  const notes = [261.63, 329.63, 392, 523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    tone(b, { start: i * 0.1, dur: 1.4, freq: f, gain: 0.16, attack: 0.02 });
    tone(b, { start: i * 0.1, dur: 0.9, freq: f * 2.01, gain: 0.05, attack: 0.03 });
  });
  for (let i = 0; i < 30; i += 1) {
    noiseBurst(b, { start: 0.2 + i * 0.03, dur: 0.06, gain: 0.03, seed: 70 + i, low: 3000, high: 9000 });
  }
  return fadeEdges(normalize(reverb(b, 0.44, 0.5), 0.7));
};

SOUNDS.hurt = () => {
  const b = makeBuffer(0.5);
  tone(b, { dur: 0.36, freq: 180, sweep: 0.45, type: 'saw', gain: 0.3, attack: 0.002 });
  noiseBurst(b, { dur: 0.3, gain: 0.28, seed: 81, low: 250, high: 1600 });
  return fadeEdges(softClip(normalize(b, 0.6), 1.5));
};

SOUNDS.growl = () => {
  const b = makeBuffer(1.4);
  const rand = rng(91);
  for (let i = 0; i < b.length; i += 1) {
    const t = i / SR;
    const wobble = 1 + 0.3 * Math.sin(TAU * 7.3 * t);
    const base = 58 * wobble + 12 * Math.sin(TAU * 0.8 * t);
    const saw = 2 * ((base * t) % 1) - 1;
    const e = env(t, 0.15, 1.2, 1.3);
    b[i] = saw * e * 0.32 + (rand() * 2 - 1) * e * 0.06;
  }
  bandpass(b, 60, 700);
  return fadeEdges(softClip(normalize(b, 0.5), 1.4));
};

SOUNDS.hit = () => {
  const b = makeBuffer(0.3);
  tone(b, { dur: 0.16, freq: 140, sweep: 0.55, gain: 0.5, attack: 0.001 });
  noiseBurst(b, { dur: 0.1, gain: 0.24, seed: 101, low: 900, high: 4000 });
  return fadeEdges(softClip(normalize(b, 0.62), 1.2));
};

SOUNDS.sleep = () => {
  const b = makeBuffer(2.0);
  [220, 164.81, 130.81].forEach((f, i) => {
    tone(b, { start: i * 0.35, dur: 1.5, freq: f, gain: 0.16, attack: 0.25 });
  });
  noiseBurst(b, { dur: 1.4, gain: 0.05, seed: 111, low: 200, high: 900 });
  return fadeEdges(normalize(reverb(b, 0.3, 0.4), 0.45));
};

SOUNDS.footstep = () => {
  const b = makeBuffer(0.2);
  noiseBurst(b, { dur: 0.12, gain: 0.3, seed: 121, low: 60, high: 700 });
  tone(b, { dur: 0.08, freq: 90, sweep: 0.7, gain: 0.16, attack: 0.002 });
  return fadeEdges(normalize(b, 0.4));
};

SOUNDS.equip = () => {
  const b = makeBuffer(0.34);
  noiseBurst(b, { dur: 0.1, gain: 0.16, seed: 131, low: 1800, high: 7000 });
  tone(b, { dur: 0.16, freq: 320, sweep: 1.6, gain: 0.2, attack: 0.002 });
  tone(b, { start: 0.05, dur: 0.2, freq: 640, sweep: 1.1, gain: 0.1, attack: 0.004 });
  return fadeEdges(normalize(b, 0.45));
};

SOUNDS.consume = () => {
  const b = makeBuffer(0.4);
  for (let i = 0; i < 3; i += 1) {
    tone(b, { start: i * 0.09, dur: 0.09, freq: 300 - i * 30, sweep: 0.7, gain: 0.2, attack: 0.006 });
  }
  noiseBurst(b, { start: 0.05, dur: 0.2, gain: 0.08, seed: 141, low: 300, high: 1200 });
  return fadeEdges(normalize(b, 0.45));
};

SOUNDS.swing = () => {
  const b = makeBuffer(0.26);
  const rand = rng(151);
  for (let i = 0; i < b.length; i += 1) {
    const t = i / SR;
    b[i] = (rand() * 2 - 1) * Math.sin(Math.PI * (t / 0.26)) * 0.35;
  }
  bandpass(b, 500, 3000);
  return fadeEdges(normalize(b, 0.35));
};

// ── Ambience & music ──────────────────────────────────────────────────────
function windLayer(seconds, seed, gain, cutoff = 420) {
  const rand = rng(seed);
  const b = new Float32Array(Math.ceil(seconds * SR) + SR);
  let lp = 0;
  const dt = 1 / SR;
  const rc = 1 / (TAU * cutoff);
  const alpha = dt / (rc + dt);
  for (let i = 0; i < b.length; i += 1) {
    const t = i / SR;
    lp += alpha * ((rand() * 2 - 1) - lp);
    const mod = 0.55 + 0.45 * Math.sin(TAU * 0.07 * t + 1.2) * Math.sin(TAU * 0.031 * t);
    b[i] = lp * mod * gain;
  }
  return b;
}

SOUNDS.ambience_day = () => {
  const length = 26;
  const b = makeBuffer(length + 1);
  const wind = windLayer(length + 1, 201, 0.5, 500);
  mixInto(b, wind);
  const rand = rng(202);
  // Sparse birdsong across the loop.
  for (let i = 0; i < 16; i += 1) {
    const start = 1 + rand() * (length - 3);
    const base = 2200 + rand() * 1400;
    const notes = 2 + Math.floor(rand() * 4);
    for (let n = 0; n < notes; n += 1) {
      tone(b, {
        start: start + n * 0.09,
        dur: 0.08,
        freq: base * (1 + rand() * 0.25),
        sweep: 1.15,
        gain: 0.035 + rand() * 0.03,
        attack: 0.006,
      });
    }
  }
  // Leaf rustle.
  noiseBurst(b, { start: 0, dur: length, gain: 0.03, seed: 203, low: 1200, high: 5200 });
  return fadeEdges(makeSeamless(b, 1.2), 0.01);
};

SOUNDS.ambience_night = () => {
  const length = 26;
  const b = makeBuffer(length + 1);
  const wind = windLayer(length + 1, 301, 0.34, 320);
  mixInto(b, wind);
  const rand = rng(302);
  // Cricket pulse trains.
  for (let layer = 0; layer < 3; layer += 1) {
    const freq = 3800 + layer * 420;
    const period = 0.55 + layer * 0.13;
    for (let t = 0.5; t < length + 0.5; t += period) {
      for (let p = 0; p < 3; p += 1) {
        tone(b, { start: t + p * 0.035, dur: 0.018, freq, gain: 0.012 + layer * 0.004, attack: 0.002 });
      }
    }
  }
  // Distant owl.
  for (let i = 0; i < 3; i += 1) {
    const start = 3 + i * 8 + rand() * 2;
    tone(b, { start, dur: 0.5, freq: 340, sweep: 0.94, gain: 0.05, attack: 0.12 });
    tone(b, { start: start + 0.6, dur: 0.42, freq: 300, sweep: 0.92, gain: 0.04, attack: 0.1 });
  }
  return fadeEdges(makeSeamless(b, 1.2), 0.01);
};

function padChord(b, startSeconds, seconds, freqs, gain = 0.1) {
  for (const f of freqs) {
    tone(b, { start: startSeconds, dur: seconds, freq: f, gain, attack: seconds * 0.35 });
    tone(b, { start: startSeconds, dur: seconds, freq: f * 1.005, gain: gain * 0.5, attack: seconds * 0.4 });
    tone(b, { start: startSeconds, dur: seconds, freq: f * 0.5, gain: gain * 0.4, attack: seconds * 0.4 });
  }
}

SOUNDS.music_menu = () => {
  const length = 42;
  const b = makeBuffer(length + 2);
  const chords = [
    [220, 261.63, 329.63], // Am
    [174.61, 220, 261.63], // F
    [130.81, 196, 261.63], // C
    [196, 246.94, 293.66], // G
  ];
  chords.forEach((chord, i) => {
    padChord(b, i * 8, 9.5, chord, 0.055);
  });
  // Sparse, memorable motif.
  const melody = [
    [1.2, 659.25, 1.1], [2.9, 587.33, 0.9], [4.2, 523.25, 1.4],
    [9.0, 523.25, 1.0], [10.6, 440, 1.2], [12.1, 392, 1.3],
    [17.2, 392, 0.9], [18.9, 523.25, 1.1], [20.4, 659.25, 1.5],
    [25.4, 587.33, 1.0], [27.0, 523.25, 1.2], [28.6, 440, 1.6],
    [33.4, 493.88, 1.5], [35.2, 587.33, 1.6],
  ];
  for (const [start, freq, dur] of melody) {
    tone(b, { start, dur, freq, gain: 0.075, attack: 0.02 });
    tone(b, { start, dur: dur * 0.7, freq: freq * 2, gain: 0.02, attack: 0.02 });
  }
  const processed = reverb(b, 0.42, 0.5);
  lowpass(processed, 4200);
  return fadeEdges(makeSeamless(normalize(processed, 0.55), 1.4), 0.01);
};

SOUNDS.music_explore = () => {
  const length = 40;
  const b = makeBuffer(length + 2);
  const chords = [
    [146.83, 174.61, 220], // Dm
    [130.81, 174.61, 196], // C/G-ish
    [116.54, 146.83, 174.61], // Bb
    [110, 164.81, 220], // Am
  ];
  chords.forEach((chord, i) => padChord(b, i * 8, 9, chord, 0.05));
  const notes = [440, 523.25, 587.33, 659.25, 523.25, 440, 392, 440];
  for (let i = 0; i < 24; i += 1) {
    const start = 1.5 + i * 1.55;
    const f = notes[i % notes.length];
    const dur = 0.9 + (i % 3) * 0.4;
    tone(b, { start, dur, freq: f, type: 'triangle', gain: 0.05, attack: 0.01 });
    tone(b, { start: start + 0.02, dur: dur * 0.5, freq: f * 2, gain: 0.014, attack: 0.01 });
  }
  const processed = reverb(b, 0.36, 0.44);
  lowpass(processed, 3600);
  return fadeEdges(makeSeamless(normalize(processed, 0.5), 1.4), 0.01);
};

// ── Render ────────────────────────────────────────────────────────────────
const ORDER = [
  'ui_tap', 'ui_open', 'ui_close', 'ui_error',
  'chop', 'mine', 'pick', 'water', 'pickup',
  'craft', 'craft_done', 'build', 'quest', 'level_up',
  'hurt', 'growl', 'hit', 'sleep', 'footstep', 'equip', 'consume', 'swing',
  'ambience_day', 'ambience_night', 'music_menu', 'music_explore',
];

let total = 0;
for (const name of ORDER) {
  const samples = SOUNDS[name]();
  const wav = join(TMP, `${name}.wav`);
  const mp3 = join(OUT, `${name}.mp3`);
  writeWav(wav, samples);
  const bitrate = name.startsWith('music') || name.startsWith('ambience') ? '64k' : '72k';
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', bitrate, '-ar', String(SR), '-ac', '1', mp3]);
  const size = statSync(mp3).size;
  total += size;
  console.log(`  ✓ ${name.padEnd(16)} ${(samples.length / SR).toFixed(1)}s  ${(size / 1024).toFixed(0)} KB`);
}

rmSync(TMP, { recursive: true, force: true });
console.log(`\nAudio built: ${ORDER.length} files, ${(total / 1024 / 1024).toFixed(2)} MB total.`);

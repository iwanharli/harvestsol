// Procedural background music: a soft lo-fi loop per season, calmer at night.
import { getAudio } from './sfx';
import type { Season } from './data';

interface Mood {
  bpm: number;
  root: number; // MIDI note of the key
  minor: boolean;
  chords: number[]; // scale degrees (0-based) of each bar's chord
}

const MOODS: Record<Season, Mood> = {
  Tanam: { bpm: 92, root: 60, minor: false, chords: [0, 4, 5, 3] }, // bright: I V vi IV
  Hujan: { bpm: 78, root: 57, minor: true, chords: [0, 5, 2, 6] }, // rainy and soft: i VI III VII
  Panen: { bpm: 104, root: 62, minor: false, chords: [0, 3, 4, 3] }, // festive: I IV V IV
  Kemarau: { bpm: 84, root: 64, minor: true, chords: [0, 3, 6, 4] }, // hot and hazy: i iv VII v
};

const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const MINOR = [0, 2, 3, 5, 7, 8, 10];

const freq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

let enabled = true;
try {
  enabled = localStorage.getItem('cropfarm-music') !== '0';
} catch {
  // default on
}

let gain: GainNode | undefined;
let timer: number | undefined;
let season: Season = 'Tanam';
let night = false;
let festival = false;
let step = 0; // eighth-note counter
let nextTime = 0;
let noise: AudioBuffer | undefined;

/** Small seeded RNG so each season always plays the same melody. */
function rng(seed: number) {
  return () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
}

/** 8 bars x 8 steps of melody, as scale degrees (or null for a rest). */
function melodyFor(s: Season): (number | null)[] {
  const r = rng(s.length * 977 + s.charCodeAt(0) * 31);
  const mood = MOODS[s];
  const out: (number | null)[] = [];
  let deg = 4;
  for (let bar = 0; bar < 8; bar++) {
    const chord = mood.chords[bar % 4];
    for (let i = 0; i < 8; i++) {
      const strong = i % 4 === 0;
      if (!strong && r() < 0.45) {
        out.push(null);
        continue;
      }
      // strong beats land on a chord tone, others step around the pentatonic shape
      if (strong) deg = chord + [0, 2, 4][Math.floor(r() * 3)];
      else deg += [-1, 1, 2, -2][Math.floor(r() * 4)];
      deg = Math.max(0, Math.min(9, deg));
      out.push(deg);
    }
  }
  return out;
}

const melodies = new Map<Season, (number | null)[]>();

function note(ctx: AudioContext, out: AudioNode, midi: number, t: number, dur: number, type: OscillatorType, vol: number) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq(midi), t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.05);
}

function hat(ctx: AudioContext, out: AudioNode, t: number, vol: number) {
  if (!noise) {
    noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * 0.05), ctx.sampleRate);
    const d = noise.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const src = ctx.createBufferSource();
  src.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = 'highpass';
  f.frequency.value = 7000;
  const g = ctx.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);
  src.connect(f).connect(g).connect(out);
  src.start(t);
}

function scheduleStep(ctx: AudioContext, out: AudioNode, t: number, eighth: number) {
  const mood = MOODS[season];
  const scale = mood.minor ? MINOR : MAJOR;
  const pitch = (deg: number, octave = 0) => mood.root + scale[((deg % 7) + 7) % 7] + 12 * (Math.floor(deg / 7) + octave);
  const bar = Math.floor(step / 8);
  const i = step % 8;
  const chord = mood.chords[bar % 4];
  const quiet = night ? 0.6 : 1;

  // bass: root on beats 1 and 3
  if (i === 0 || i === 4) note(ctx, out, pitch(chord, -2), t, eighth * 3.5, 'triangle', 0.16 * quiet);
  // soft arpeggio through the chord
  const arp = [0, 2, 4, 2][i % 4];
  note(ctx, out, pitch(chord + arp, -1), t, eighth * 1.8, 'sine', 0.05 * quiet);
  // melody (sparser at night)
  let mel = melodies.get(season);
  if (!mel) melodies.set(season, (mel = melodyFor(season)));
  const m = mel[step % mel.length];
  if (m !== null && (!night || i % 2 === 0)) note(ctx, out, pitch(m), t, eighth * (night ? 2.4 : 1.6), 'triangle', 0.075 * quiet);
  // light hi-hat during the day
  if (!night && i % 2 === 1) hat(ctx, out, t, festival ? 0.05 : 0.03);
}

function tick() {
  const a = getAudio();
  if (!a || !gain) return;
  const mood = MOODS[season];
  const bpm = (mood.bpm + (festival ? 10 : 0)) * (night ? 0.82 : 1);
  const eighth = 60 / bpm / 2;
  // schedule ahead so timing stays tight even if the tab hiccups
  if (nextTime < a.ctx.currentTime) nextTime = a.ctx.currentTime + 0.05;
  while (nextTime < a.ctx.currentTime + 0.25) {
    scheduleStep(a.ctx, gain, nextTime, eighth);
    nextTime += eighth;
    step = (step + 1) % 64;
  }
}

/** Start the loop (safe to call repeatedly; needs a prior user gesture). */
export function startMusic() {
  const a = getAudio();
  if (!a || timer !== undefined) return;
  gain = a.ctx.createGain();
  gain.gain.value = enabled ? 0.55 : 0; // M (mute) silences the shared master instead
  gain.connect(a.master);
  nextTime = a.ctx.currentTime + 0.1;
  timer = window.setInterval(tick, 100);
}

/** Follow the game's season, time of day and festival days. */
export function setMood(s: Season, isNight: boolean, isFestival: boolean, isRainy = false) {
  season = s;
  night = isNight || isRainy;
  festival = isFestival;
}

export function toggleMusic() {
  enabled = !enabled;
  if (gain) gain.gain.value = enabled ? 0.55 : 0;
  try {
    localStorage.setItem('cropfarm-music', enabled ? '1' : '0');
  } catch {
    // ignore
  }
  return enabled;
}

/** Briefly fade out (e.g. while sleeping) and back in. */
export function duck(ms: number) {
  const a = getAudio();
  if (!a || !gain || !enabled) return;
  const t = a.ctx.currentTime;
  gain.gain.cancelScheduledValues(t);
  gain.gain.setValueAtTime(gain.gain.value, t);
  gain.gain.linearRampToValueAtTime(0.0001, t + 0.4);
  gain.gain.linearRampToValueAtTime(0.55, t + ms / 1000);
}

// Tiny synthesized sound effects (Web Audio), so the prototype needs no audio files.

type Sfx = 'hoe' | 'water' | 'plant' | 'harvest' | 'coin' | 'click' | 'sleep' | 'error' | 'place' | 'quest' | 'cluck';

let ctx: AudioContext | undefined;
let master: GainNode | undefined;
let muted = false;

try {
  muted = localStorage.getItem('cropfarm-muted') === '1';
} catch {
  // storage unavailable: default to sound on
}

function audio() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return undefined;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.5;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

/** Shared audio graph, so music plays through the same master (M mutes everything). */
export function getAudio() {
  const c = audio();
  return c && master ? { ctx: c, master } : undefined;
}

/** Browsers only allow audio after a user gesture; call this from the first input. */
export function unlockAudio() {
  audio();
}

export function isMuted() {
  return muted;
}

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.value = muted ? 0 : 0.5;
  try {
    localStorage.setItem('cropfarm-muted', muted ? '1' : '0');
  } catch {
    // ignore
  }
  return muted;
}

function tone(freq: number, start: number, dur: number, type: OscillatorType = 'square', vol = 0.15, slideTo?: number) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + start;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function noise(start: number, dur: number, filterFreq: number, vol = 0.2, q = 1) {
  const c = audio();
  if (!c || !master) return;
  const t = c.currentTime + start;
  const len = Math.ceil(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'bandpass';
  f.frequency.value = filterFreq;
  f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t);
}

export function play(name: Sfx) {
  if (muted) return;
  switch (name) {
    case 'hoe':
      noise(0, 0.12, 350, 0.5, 0.8);
      tone(110, 0, 0.1, 'triangle', 0.2, 60);
      break;
    case 'water':
      noise(0, 0.35, 2200, 0.25, 0.6);
      noise(0.05, 0.3, 3200, 0.12, 0.8);
      break;
    case 'plant':
      tone(520, 0, 0.08, 'sine', 0.2, 780);
      break;
    case 'place':
      tone(220, 0, 0.06, 'square', 0.12);
      tone(330, 0.06, 0.08, 'square', 0.12);
      break;
    case 'harvest':
      tone(523, 0, 0.09, 'square', 0.12);
      tone(659, 0.07, 0.09, 'square', 0.12);
      tone(784, 0.14, 0.14, 'square', 0.12);
      break;
    case 'coin':
      tone(988, 0, 0.08, 'square', 0.1);
      tone(1319, 0.07, 0.22, 'square', 0.1);
      break;
    case 'quest':
      [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.09, 0.18, 'triangle', 0.18));
      tone(1319, 0.38, 0.3, 'square', 0.08);
      break;
    case 'click':
      tone(660, 0, 0.04, 'square', 0.08);
      break;
    case 'sleep':
      [523, 440, 392, 330].forEach((f, i) => tone(f, i * 0.18, 0.3, 'sine', 0.15));
      break;
    case 'cluck':
      tone(700, 0, 0.07, 'square', 0.08, 900);
      tone(620, 0.09, 0.09, 'square', 0.08, 820);
      break;
    case 'error':
      tone(140, 0, 0.15, 'square', 0.1, 100);
      break;
  }
}

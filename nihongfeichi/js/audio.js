/* 音频模块：音效合成 + 背景音乐引擎 */
import { ui } from './ui.js';

let AC = null, engineOsc = null, engineGain = null;

export function getAC() { return AC; }

export function initAudio() {
  if (AC) return;
  AC = new (window.AudioContext || window.webkitAudioContext)();
  engineOsc = AC.createOscillator(); engineOsc.type = 'sawtooth';
  engineGain = AC.createGain();
  const lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
  const lfo = AC.createOscillator(); lfo.frequency.value = 26;
  const lfoG = AC.createGain(); lfoG.gain.value = 14;
  lfo.connect(lfoG); lfoG.connect(engineOsc.frequency);
  engineOsc.connect(lp); lp.connect(engineGain); engineGain.connect(AC.destination);
  engineGain.gain.value = 0;
  engineOsc.frequency.value = 60;
  engineOsc.start(); lfo.start();
}

export function engineStart() {
  if (engineGain) engineGain.gain.linearRampToValueAtTime(0.07, AC.currentTime + 0.5);
}
export function engineStop() {
  if (engineGain) engineGain.gain.linearRampToValueAtTime(0, AC.currentTime + 0.3);
}
export function engineMute() { if (engineGain) engineGain.gain.value = 0; }
export function engineResume() { if (engineGain) engineGain.gain.value = 0.07; }
export function engineFreq(throttle) {
  if (engineOsc) engineOsc.frequency.linearRampToValueAtTime(50 + throttle * 90, AC.currentTime + 0.1);
}

function blip(freq, dur, type, vol, slide) {
  if (!AC) return;
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.value = freq;
  if (slide) o.frequency.exponentialRampToValueAtTime(slide, AC.currentTime + dur);
  g.gain.setValueAtTime(vol, AC.currentTime);
  g.gain.exponentialRampToValueAtTime(0.0001, AC.currentTime + dur);
  o.connect(g); g.connect(AC.destination);
  o.start(); o.stop(AC.currentTime + dur);
}

function noiseBurst(dur, vol, freq) {
  if (!AC) return;
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(AC.destination);
  src.start();
}

export const sfx = {
  gem:    () => { blip(880, 0.12, 'sine', 0.18, 1320); blip(1320, 0.18, 'sine', 0.1, 1760); },
  ring:   () => { blip(520, 0.3, 'square', 0.1, 1040); blip(780, 0.4, 'sine', 0.14, 1560); },
  shield: () => blip(300, 0.5, 'sine', 0.16, 900),
  crash:  () => { noiseBurst(0.5, 0.5, 900); blip(160, 0.5, 'sawtooth', 0.25, 40); },
  click:  () => blip(660, 0.08, 'square', 0.1, 880)
};

/* ---------- 背景音乐（合成波循环） ---------- */
let musicGain = null, musStep = 0, musNext = 0;
let musicOn = localStorage.getItem('neon_music') !== '0';

const CHORDS = [
  [110.0, 1.1892],   /* Am */
  [87.31, 1.2599],   /* F  */
  [130.81, 1.2599],  /* C  */
  [98.0, 1.2599]     /* G  */
];

export function isMusicOn() { return musicOn; }

export function startMusic() {
  if (!AC || musicGain) return;
  musicGain = AC.createGain();
  musicGain.gain.value = musicOn ? 0.9 : 0;
  musicGain.connect(AC.destination);
  musStep = 0; musNext = AC.currentTime + 0.1;
}

function musOsc(freq, t, dur, type, vol, slideTo) {
  const o = AC.createOscillator(), g = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(musicGain);
  o.start(t); o.stop(t + dur + 0.02);
}

function musNoise(t, dur, vol, freq) {
  const len = Math.floor(AC.sampleRate * dur);
  const buf = AC.createBuffer(1, len, AC.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = AC.createBufferSource(); src.buffer = buf;
  const f = AC.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = freq;
  const g = AC.createGain(); g.gain.value = vol;
  src.connect(f); f.connect(g); g.connect(musicGain);
  src.start(t);
}

function scheduleStep(step, t) {
  const bar = Math.floor(step / 16) % 4, s16 = step % 16;
  const root = CHORDS[bar][0], third = CHORDS[bar][1];
  if (s16 % 4 === 0) musOsc(130, t, 0.14, 'sine', 0.5, 42);              /* kick */
  if (s16 % 2 === 1) musNoise(t, 0.03, 0.06, 7000);                      /* hat  */
  if (s16 === 0 || s16 === 6 || s16 === 10) musOsc(root, t, 0.3, 'sawtooth', 0.12); /* bass */
  const arpN = [root * 4, root * 4 * third, root * 4 * 1.4983, root * 8][step % 4];
  musOsc(arpN, t, 0.11, 'square', 0.035);                                /* arp  */
  if (s16 === 0) [1, third, 1.4983].forEach(iv => {                      /* pad  */
    musOsc(root * 2 * iv, t, 2.2, 'triangle', 0.03);
  });
}

export function pumpMusic() {
  if (!AC || !musicGain) return;
  while (musNext < AC.currentTime + 0.25) {
    scheduleStep(musStep, musNext);
    musNext += 0.15;                 /* 100 BPM 的 16 分音符 */
    musStep = (musStep + 1) % 64;
  }
}

export function setMusic(on) {
  musicOn = on;
  localStorage.setItem('neon_music', on ? '1' : '0');
  if (musicGain && AC) musicGain.gain.linearRampToValueAtTime(on ? 0.9 : 0, AC.currentTime + 0.2);
  ui.musicBtn.textContent = on ? '音乐：开' : '音乐：关';
}

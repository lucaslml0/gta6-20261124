// Synthesised sound only — no audio files. A single AudioContext built on the first user
// gesture (browsers block audio before that) drives a tiny engine hum, a two-tone police siren,
// and one-shot bleeps for pickups, punches, gunshots, crashes and mission completes.
let ctx = null;
let master = null;
let engineOsc = null;
let engineGain = null;
let sirenOsc = null;
let sirenGain = null;
let sirenTimer = 0;
let sirenHigh = false;
let muted = false;

export function initAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
    engineOsc = ctx.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 40;
    engineGain = ctx.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineGain);
    engineGain.connect(master);
    engineOsc.start();
    sirenOsc = ctx.createOscillator();
    sirenOsc.type = 'sine';
    sirenOsc.frequency.value = 660;
    sirenGain = ctx.createGain();
    sirenGain.gain.value = 0;
    sirenOsc.connect(sirenGain);
    sirenGain.connect(master);
    sirenOsc.start();
  } catch {
    ctx = null;
  }
}

/** Continuous layers, called every frame: engine pitch follows speed, siren wails while wanted. */
export function updateAudio(speed01, wanted, dt) {
  if (!ctx || muted) return;
  engineGain.gain.value = 0.02 + speed01 * 0.05;
  engineOsc.frequency.value = 42 + speed01 * 130;
  if (wanted > 0) {
    sirenGain.gain.value = 0.05;
    sirenTimer -= dt;
    if (sirenTimer <= 0) {
      sirenTimer = 0.42;
      sirenHigh = !sirenHigh;
      sirenOsc.frequency.value = sirenHigh ? 880 : 660;
    }
  } else {
    sirenGain.gain.value = 0;
  }
}

function blip(freq, dur, type, vol, slideTo) {
  if (!ctx || muted) return;
  try {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.value = freq;
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, ctx.currentTime + dur);
    gain.gain.setValueAtTime(vol || 0.2, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start();
    osc.stop(ctx.currentTime + dur);
  } catch {
    // Audio is decoration; a failure never breaks the game.
  }
}

export const sfx = {
  pickup() { blip(880, 0.12, 'sine', 0.25, 1320); },
  punch() { blip(140, 0.1, 'square', 0.3, 70); },
  shoot() { blip(1200, 0.08, 'square', 0.22, 300); },
  crash() { blip(90, 0.25, 'sawtooth', 0.35, 40); },
  steal() { blip(520, 0.15, 'triangle', 0.25, 780); },
  mission() {
    blip(523, 0.12, 'sine', 0.25);
    setTimeout(() => blip(659, 0.12, 'sine', 0.25), 120);
    setTimeout(() => blip(784, 0.22, 'sine', 0.25), 240);
  },
  busted() { blip(220, 0.5, 'sawtooth', 0.3, 110); },
};

// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s steps
// (several in a slow frame, none in a fast one), and the renderer paints what is there. The game
// moves between four screens: title, play, paused and game over. Cash and mission progress save
// to localStorage, so Continue on the title screen picks up where you left off.
//
// ?seed=N fixes the city layout. ?shot=start|play|end (with &seed=N) stages that scene instead
// of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { SAVE_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_HIT, EVENT_MISSION, EVENT_OVER, EVENT_WANTED } from './world.js';
import { ACTION_ATTACK, ACTION_CONFIRM, ACTION_ENTER, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { initAudio, sfx, updateAudio } from './audio.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const ctx = canvas.getContext('2d');
let frameCount = 0;

/** Subtle speed lines streaking past the screen edges while driving above 200. */
function drawSpeedLines(currentScreen) {
  if (currentScreen !== SCREEN_PLAY) return;
  const speed = world.state.player.speed;
  if (speed < 200) return;
  const ratio = Math.min(1, (speed - 200) / 240);
  const w = canvas.width;
  const h = canvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.10 + 0.25 * ratio})`;
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    const y = (((frameCount * 37 + i * 173) % 1000) / 1000) * h;
    const len = 40 + ratio * 90;
    const x = i % 2 === 0 ? 8 : w - 8 - len;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  ctx.restore();
}

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const save = JSON.parse(raw);
    if (typeof save.cash !== 'number' || typeof save.missionIndex !== 'number') return null;
    return save;
  } catch {
    return null;
  }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: world.state.cash, missionIndex: world.state.missionIndex }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  // Paint synchronously (twice, like the frame loop would): headless screenshot runs may
  // capture before a requestAnimationFrame callback ever fires.
  renderer.draw(world.state, scene.screen, scene.save);
  renderer.draw(world.state, scene.screen, scene.save);
  window.__shotReady = true;
}

function runGame() {
  const input = createInput(canvas, renderer.toLogical);
  let screen = SCREEN_TITLE;
  let save = readSave();
  let accumulator = 0;
  let last = performance.now();
  let buttons = [];

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    world.reset();
    if (!fresh && save) world.loadProgress(save);
    accumulator = 0;
    screen = SCREEN_PLAY;
    initAudio();
    announce(`Playing. Mission ${world.state.missionIndex + 1} of 3.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    writeSave();
    const over = world.state.over;
    announce(over === 'complete' ? `You own the city. Cash $${world.state.cash}.` : over === 'busted' ? 'Busted by the cops.' : 'Wasted.');
    if (over !== 'complete') sfx.busted();
  }

  function handleActions(actions) {
    const pointer = input.pointer();
    if (screen === SCREEN_TITLE) {
      if (actions & ACTION_CONFIRM) {
        // A click on a button wins over a bare keypress.
        if (pointer.down) {
          for (const b of buttons) {
            if (pointer.x >= b.x && pointer.x <= b.x + b.w && pointer.y >= b.y && pointer.y <= b.y + b.h) {
              startGame(b.id === 'start');
              return;
            }
          }
        }
        startGame(!save || save.missionIndex === 0);
      }
      return;
    }
    if (screen === SCREEN_OVER) {
      if (actions & ACTION_CONFIRM) {
        world.reset();
        screen = SCREEN_TITLE;
        save = readSave();
        announce('Vice City Nights. Press Enter or click Start.');
      }
      return;
    }
    if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & (ACTION_PAUSE | ACTION_CONFIRM) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  function step(actions) {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { mx: 0, my: 0, enter: false, attack: false }, true);
      return;
    }
    const vec = input.vector();
    const events = world.step(STEP, {
      mx: vec.x,
      my: vec.y,
      enter: Boolean(actions & ACTION_ENTER),
      attack: Boolean(actions & ACTION_ATTACK),
    }, false);
    if (events & EVENT_MISSION) {
      sfx.mission();
      writeSave();
      save = readSave();
    }
    if (events & EVENT_WANTED) sfx.crash();
    if (events & EVENT_HIT) sfx.crash();
    if (events & EVENT_OVER) endGame();
    if (world.state.saveDirty) {
      world.state.saveDirty = false;
      writeSave();
      save = readSave();
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    updateAudio(world.state.player.speed / 460, world.state.wanted, 1 / 60);
    buttons = renderer.draw(world.state, screen, save) || [];
    frameCount++;
    drawSpeedLines(screen);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });
  // First gesture unlocks audio.
  window.addEventListener('pointerdown', initAudio, { once: true });
  window.addEventListener('keydown', initAudio, { once: true });

  announce('Vice City Nights. Press Enter or click Start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

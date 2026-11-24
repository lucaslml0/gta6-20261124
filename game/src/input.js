// Keyboard and pointer input for Vice City Nights. Held keys give a 2D move vector; one-shot
// presses (confirm, pause, enter/exit car, attack) are queued as bit flags and taken once by the
// loop, so a press between two frames is never lost and never counted twice. Pointer position is
// reported in logical 1280x720 canvas coordinates so the title screen's buttons are clickable.
import { VIEW } from './config.js';

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_ENTER = 4;
export const ACTION_ATTACK = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const ENTER = new Set(['KeyE']);
const ATTACK = new Set(['Space']);

export function createInput(canvas, toLogical) {
  let up = false;
  let down = false;
  let left = false;
  let right = false;
  let actions = 0;
  let pointer = { x: VIEW.width / 2, y: VIEW.height / 2, down: false };

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code)) up = true;
    else if (DOWN.has(event.code)) down = true;
    else if (LEFT.has(event.code)) left = true;
    else if (RIGHT.has(event.code)) right = true;
    else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (ENTER.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ENTER;
    } else if (ATTACK.has(event.code)) {
      if (!event.repeat) actions |= ACTION_ATTACK;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    if (UP.has(event.code)) up = false;
    else if (DOWN.has(event.code)) down = false;
    else if (LEFT.has(event.code)) left = false;
    else if (RIGHT.has(event.code)) right = false;
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => {
    up = down = left = right = false;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const logical = toLogical(event.clientX, event.clientY);
    pointer = { x: logical.x, y: logical.y, down: true };
    actions |= ACTION_CONFIRM;
  });
  canvas.addEventListener('pointermove', (event) => {
    const logical = toLogical(event.clientX, event.clientY);
    pointer = { x: logical.x, y: logical.y, down: pointer.down };
  });
  canvas.addEventListener('pointerup', () => {
    pointer = { x: pointer.x, y: pointer.y, down: false };
  });

  return {
    /** Normalised move vector, e.g. {x: 0, y: -1} for up. */
    vector() {
      const x = (right ? 1 : 0) - (left ? 1 : 0);
      const y = (down ? 1 : 0) - (up ? 1 : 0);
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const len = Math.hypot(x, y);
      return { x: x / len, y: y / len };
    },
    pointer() {
      return pointer;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}

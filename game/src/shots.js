// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules forward from
// a fresh world, steered by a simple autopilot that drives toward the current mission target
// along the road grid, so the frame is what a short game really looks like and the same seed
// always gives the same frame.
import { MISSIONS, STEP } from './config.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Steer toward a point: returns the {mx, my, enter, attack} input the world expects. */
function driveToward(state, tx, ty) {
  const p = state.player;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const d = Math.hypot(dx, dy);
  if (d < 30) return { mx: 0, my: 0, enter: false, attack: false };
  const want = Math.atan2(dy, dx);
  let diff = want - p.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const mx = Math.abs(diff) > 0.25 ? (diff > 0 ? 1 : -1) : 0;
  // On foot the vector points at the target; in a car, my<0 is the accelerator.
  if (p.car) return { mx, my: Math.abs(diff) > 1.2 ? 0.4 : -1, enter: false, attack: false };
  const len = Math.max(0.001, d);
  return { mx: dx / len, my: dy / len, enter: false, attack: false };
}

function nearestRoad(list, v) {
  let best = list[0];
  let bestD = Infinity;
  for (const r of list) {
    const d = Math.abs(r - v);
    if (d < bestD) {
      bestD = d;
      best = r;
    }
  }
  return best;
}

/**
 * Route to a target through the road grid: nearest intersection, then along one road to the
 * target's road, then along that road to the target. Roads are always clear of buildings, so
 * the autopilot never gets stuck on a block while the cops close in.
 */
function routeToward(state, tx, ty) {
  const p = state.player;
  const rx = nearestRoad(state.roadsV, tx);
  const ry = nearestRoad(state.roadsH, ty);
  const waypoints = [
    { x: nearestRoad(state.roadsV, p.x), y: nearestRoad(state.roadsH, p.y) },
    { x: rx, y: nearestRoad(state.roadsH, p.y) },
    { x: rx, y: ry },
    { x: tx, y: ty },
  ];
  for (const w of waypoints) {
    if (Math.hypot(w.x - p.x, w.y - p.y) > 50) return driveToward(state, w.x, w.y);
  }
  return { mx: 0, my: 0, enter: false, attack: false };
}

function autopilot(state) {
  const p = state.player;
  if (!p.car) {
    // Walk to the nearest stealable car and get in.
    let best = null;
    let bestD = Infinity;
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      const d = Math.hypot(car.x - p.x, car.y - p.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    if (best && bestD < 60) return { mx: 0, my: 0, enter: true, attack: false };
    if (best) return routeToward(state, best.x, best.y);
    return { mx: 0, my: 0, enter: false, attack: false };
  }
  const t = state.target || state.chopShop;
  return routeToward(state, t.x, t.y);
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and return the
 * screen to draw over it.
 */
export function stageShot(name, world) {
  world.reset();
  const state = world.state;
  if (name !== 'play' && name !== 'end') {
    // Title backdrop: traffic moves for a few seconds behind the panel.
    for (let i = 0; i < 5 / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, enter: false, attack: false }, true);
    return { screen: SCREEN_TITLE, save: null };
  }
  if (name === 'end') {
    // Mission-complete end screen: all three jobs done, a fat wallet.
    state.cash = 1900;
    state.missionIndex = MISSIONS.length;
    state.over = 'complete';
    for (let i = 0; i < 3 / STEP; i += 1) world.step(STEP, { mx: 0, my: 0, enter: false, attack: false }, true);
    return { screen: SCREEN_OVER, save: null };
  }
  // Play: steal a car, get 3 stars, and drive through town with the cops on your tail. The
  // scene is staged to stay mid-chase (health topped up), so the frame shows the action.
  state.wanted = 3;
  state.maxWanted = 3;
  for (let i = 0; i < 22 / STEP; i += 1) {
    world.step(STEP, autopilot(state), false);
    if (state.player.health < 60) state.player.health = 100;
    state.bustTimer = 0;
    if (state.over) break;
  }
  return { screen: state.over ? SCREEN_OVER : SCREEN_PLAY, save: null };
}

// The game's rules and state, with no drawing and no browser in it: the city, the player on
// foot and in cars, traffic, pedestrians, police, wanted level, missions, combat and game over.
// step() advances one fixed step and returns what happened as bit flags, so the caller can
// react (sounds, saves, screen changes) without the world knowing about screens or sound.
import { CAR, COLORS, MISSIONS, PLAYER, ROAD_HALF, ROAD_SPACING, ROAD_WIDTH, WORLD } from './config.js';

export const EVENT_OVER = 1;
export const EVENT_MISSION = 2;
export const EVENT_WANTED = 4;
export const EVENT_HIT = 8;

const TAU = Math.PI * 2;

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}
function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}
function angleTo(ax, ay, bx, by) {
  return Math.atan2(by - ay, bx - ax);
}
function angleDiff(a, b) {
  let d = (b - a) % TAU;
  if (d > Math.PI) d -= TAU;
  if (d < -Math.PI) d += TAU;
  return d;
}
function circleRect(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist(cx, cy, nx, ny) < r;
}

export function createWorld(random) {
  const roadsV = [];
  const roadsH = [];
  for (let x = 200; x <= WORLD.width - 200; x += ROAD_SPACING) roadsV.push(x);
  for (let y = 200; y <= WORLD.height - 200; y += ROAD_SPACING) roadsH.push(y);

  // City blocks: buildings inside each block, some blocks are parks.
  const buildings = [];
  const parks = [];
  for (let bi = 0; bi < roadsV.length - 1; bi += 1) {
    for (let bj = 0; bj < roadsH.length - 1; bj += 1) {
      const x0 = roadsV[bi] + ROAD_HALF + 24;
      const y0 = roadsH[bj] + ROAD_HALF + 24;
      const w = roadsV[bi + 1] - roadsV[bi] - ROAD_WIDTH - 48;
      const h = roadsH[bj] - roadsH[bj] - 0 + (ROAD_SPACING - ROAD_WIDTH - 48);
      if (random() < 0.16) {
        parks.push({ x: x0, y: y0, w, h });
        continue;
      }
      const n = 1 + Math.floor(random() * 3);
      for (let k = 0; k < n; k += 1) {
        const bw = 70 + random() * (w - 90);
        const bh = 60 + random() * (h - 80);
        const bx = x0 + random() * Math.max(1, w - bw);
        const by = y0 + random() * Math.max(1, h - bh);
        const ci = Math.floor(random() * COLORS.building.length);
        buildings.push({ x: bx, y: by, w: bw, h: bh, color: COLORS.building[ci], roof: COLORS.buildingRoof[ci] });
      }
    }
  }

  const chopShop = { x: 2920, y: 1800, r: 90 };
  const state = {
    player: { x: 600, y: 640, angle: -Math.PI / 2, health: PLAYER.health, car: null, punchCd: 0, shootCd: 0, ramCd: 0, speed: 0 },
    cars: [],
    peds: [],
    bullets: [],
    packages: [],
    buildings,
    parks,
    roadsV,
    roadsH,
    chopShop,
    wanted: 0,
    cash: 0,
    missionIndex: 0,
    packagesGot: 0,
    maxWanted: 0,
    message: '',
    messageTimer: 0,
    over: null,
    elapsed: 0,
    bustTimer: 0,
    decayTimer: 0,
    speedCooldown: 0,
    saveDirty: false,
    target: null,
  };

  function onRoad(x, y) {
    for (const rx of roadsV) if (Math.abs(x - rx) <= ROAD_HALF) return true;
    for (const ry of roadsH) if (Math.abs(y - ry) <= ROAD_HALF) return true;
    return false;
  }
  function freeSpot(x, y, r) {
    if (x < 40 || y < 40 || x > WORLD.width - 40 || y > WORLD.height - 40) return false;
    for (const b of buildings) if (circleRect(x, y, r, b)) return false;
    return true;
  }
  function randomSidewalkSpot() {
    for (let tries = 0; tries < 40; tries += 1) {
      const vertical = random() < 0.5;
      if (vertical) {
        const rx = roadsV[Math.floor(random() * roadsV.length)];
        const x = rx + (random() < 0.5 ? -1 : 1) * (ROAD_HALF + 16);
        const y = 120 + random() * (WORLD.height - 240);
        if (freeSpot(x, y, 20)) return { x, y };
      } else {
        const ry = roadsH[Math.floor(random() * roadsH.length)];
        const y = ry + (random() < 0.5 ? -1 : 1) * (ROAD_HALF + 16);
        const x = 120 + random() * (WORLD.width - 240);
        if (freeSpot(x, y, 20)) return { x, y };
      }
    }
    return { x: 600, y: 640 };
  }

  function spawnTrafficCar() {
    const vertical = random() < 0.5;
    const color = COLORS.carColors[Math.floor(random() * COLORS.carColors.length)];
    if (vertical) {
      const rx = roadsV[Math.floor(random() * roadsV.length)];
      const dir = random() < 0.5 ? 1 : -1;
      return { x: rx + dir * 28, y: 100 + random() * (WORLD.height - 200), angle: dir > 0 ? Math.PI / 2 : -Math.PI / 2, speed: CAR.trafficSpeed * (0.8 + random() * 0.4), color, kind: 'traffic', axis: 'v', road: rx, dir, stolen: false, hp: 100 };
    }
    const ry = roadsH[Math.floor(random() * roadsH.length)];
    const dir = random() < 0.5 ? 1 : -1;
    return { x: 100 + random() * (WORLD.width - 200), y: ry + dir * 28, angle: dir > 0 ? 0 : Math.PI, speed: CAR.trafficSpeed * (0.8 + random() * 0.4), color, kind: 'traffic', axis: 'h', road: ry, dir, stolen: false, hp: 100 };
  }

  function spawnPed() {
    const spot = randomSidewalkSpot();
    return { x: spot.x, y: spot.y, angle: random() * TAU, speed: 34 + random() * 30, tx: spot.x, ty: spot.y, color: COLORS.pedColors[Math.floor(random() * COLORS.pedColors.length)], down: false, downTimer: 0, waitTimer: random() * 2 };
  }

  function spawnPolice() {
    const p = state.player;
    for (let tries = 0; tries < 30; tries += 1) {
      const vertical = random() < 0.5;
      let x;
      let y;
      if (vertical) {
        const rx = roadsV[Math.floor(random() * roadsV.length)];
        x = rx;
        y = clamp(p.y + (random() < 0.5 ? -1 : 1) * (520 + random() * 260), 80, WORLD.height - 80);
      } else {
        const ry = roadsH[Math.floor(random() * roadsH.length)];
        y = ry;
        x = clamp(p.x + (random() < 0.5 ? -1 : 1) * (520 + random() * 260), 80, WORLD.width - 80);
      }
      if (dist(x, y, p.x, p.y) > 480) {
        return { x, y, angle: angleTo(x, y, p.x, p.y), speed: 0, color: COLORS.police, kind: 'police', axis: 'v', road: x, dir: 1, stolen: false, hp: 100 };
      }
    }
    return { x: clamp(p.x + 600, 80, WORLD.width - 80), y: p.y, angle: 0, speed: 0, color: COLORS.police, kind: 'police', axis: 'v', road: 0, dir: 1, stolen: false, hp: 100 };
  }

  function pushOutOfBuildings(ent, r) {
    for (const b of buildings) {
      if (!circleRect(ent.x, ent.y, r, b)) continue;
      const nx = clamp(ent.x, b.x, b.x + b.w);
      const ny = clamp(ent.y, b.y, b.y + b.h);
      let dx = ent.x - nx;
      let dy = ent.y - ny;
      let d = Math.hypot(dx, dy);
      if (d === 0) {
        dx = 0;
        dy = -1;
        d = 1;
      }
      const push = r - d + 0.5;
      ent.x += (dx / d) * push;
      ent.y += (dy / d) * push;
      return true;
    }
    return false;
  }

  function raiseWanted(n) {
    const before = state.wanted;
    state.wanted = Math.min(5, state.wanted + n);
    state.maxWanted = Math.max(state.maxWanted, state.wanted);
    if (state.wanted > before) {
      state.message = `Wanted level ${state.wanted}★ — the cops are coming!`;
      state.messageTimer = 2.5;
      return true;
    }
    return false;
  }

  function completeMission() {
    const mission = MISSIONS[state.missionIndex];
    state.cash += mission.reward;
    state.message = `Mission complete: ${mission.title} — +$${mission.reward}`;
    state.messageTimer = 4;
    state.missionIndex += 1;
    state.saveDirty = true;
    if (state.missionIndex >= MISSIONS.length) {
      state.over = 'complete';
      return EVENT_MISSION | EVENT_OVER;
    }
    return EVENT_MISSION;
  }

  function reset() {
    const p = state.player;
    p.x = 600;
    p.y = 640;
    p.angle = -Math.PI / 2;
    p.health = PLAYER.health;
    p.car = null;
    p.punchCd = 0;
    p.shootCd = 0;
    p.ramCd = 0;
    p.speed = 0;
    state.cars = [];
    for (let i = 0; i < 12; i += 1) state.cars.push(spawnTrafficCar());
    for (let i = 0; i < 6; i += 1) {
      const spot = randomSidewalkSpot();
      const rx = roadsV[Math.floor(random() * roadsV.length)];
      const car = { x: rx + (random() < 0.5 ? -1 : 1) * (ROAD_HALF - 18), y: 150 + random() * (WORLD.height - 300), angle: random() < 0.5 ? Math.PI / 2 : -Math.PI / 2, speed: 0, color: COLORS.carColors[Math.floor(random() * COLORS.carColors.length)], kind: 'parked', axis: 'v', road: rx, dir: 1, stolen: false, hp: 100 };
      car.x = spot.x;
      car.y = spot.y;
      state.cars.push(car);
    }
    state.peds = [];
    for (let i = 0; i < 18; i += 1) state.peds.push(spawnPed());
    state.bullets = [];
    state.packages = [];
    const spots = [
      { x: 660, y: 260 }, { x: 1460, y: 660 }, { x: 2260, y: 1060 },
      { x: 1060, y: 1860 }, { x: 2660, y: 1460 },
    ];
    for (const s of spots) state.packages.push({ x: s.x, y: s.y, taken: false });
    state.wanted = 0;
    state.cash = 0;
    state.missionIndex = 0;
    state.packagesGot = 0;
    state.maxWanted = 0;
    state.message = '';
    state.messageTimer = 0;
    state.over = null;
    state.elapsed = 0;
    state.bustTimer = 0;
    state.decayTimer = 0;
    state.speedCooldown = 0;
    state.saveDirty = false;
    state.target = null;
  }

  function loadProgress(save) {
    state.cash = save.cash || 0;
    state.missionIndex = Math.min(save.missionIndex || 0, MISSIONS.length);
    state.packagesGot = 0;
    if (state.missionIndex >= 3) state.missionIndex = 0;
  }

  function nearestStealableCar() {
    const p = state.player;
    let best = null;
    let bestD = Infinity;
    for (const car of state.cars) {
      if (car.kind === 'police') continue;
      const d = dist(p.x, p.y, car.x, car.y);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return bestD < 70 ? best : null;
  }

  function updateTarget() {
    const m = MISSIONS[state.missionIndex];
    if (!m) {
      state.target = null;
      return;
    }
    if (m.id === 'steal') {
      const p = state.player;
      if (p.car && p.car.stolen) state.target = { x: chopShop.x, y: chopShop.y, color: COLORS.chopshop };
      else {
        const car = nearestStealableCar();
        state.target = car ? { x: car.x, y: car.y, color: '#ffffff' } : { x: chopShop.x, y: chopShop.y, color: COLORS.chopshop };
      }
    } else if (m.id === 'packages') {
      let best = null;
      let bestD = Infinity;
      for (const pkg of state.packages) {
        if (pkg.taken) continue;
        const d = dist(state.player.x, state.player.y, pkg.x, pkg.y);
        if (d < bestD) {
          bestD = d;
          best = pkg;
        }
      }
      state.target = best ? { x: best.x, y: best.y, color: COLORS.package } : null;
    } else {
      state.target = null;
    }
  }

  function stepTraffic(dt, car) {
    if (car.kind === 'parked' || car.kind === 'police') return;
    // Slow down for the car ahead in the same lane.
    let ahead = Infinity;
    for (const other of state.cars) {
      if (other === car || other.kind === 'parked') continue;
      if (other.axis !== car.axis || other.road !== car.road || other.dir !== car.dir) continue;
      const along = car.axis === 'v' ? (other.y - car.y) * car.dir : (other.x - car.x) * car.dir;
      const lateral = car.axis === 'v' ? Math.abs(other.x - car.x) : Math.abs(other.y - car.y);
      if (along > 0 && along < ahead && lateral < 40) ahead = along;
    }
    const targetSpeed = ahead < 70 ? 0 : CAR.trafficSpeed;
    car.speed += clamp(targetSpeed - car.speed, -300 * dt, 200 * dt);
    if (car.axis === 'v') car.y += car.dir * car.speed * dt;
    else car.x += car.dir * car.speed * dt;
    // At an intersection, sometimes turn onto the crossing road.
    const pos = car.axis === 'v' ? car.y : car.x;
    const roads = car.axis === 'v' ? roadsH : roadsV;
    for (const r of roads) {
      if (Math.abs(pos - r) < 4 && random() < 0.004) {
        if (car.axis === 'v') {
          car.axis = 'h';
          car.road = r;
          car.dir = random() < 0.5 ? 1 : -1;
          car.y = r + car.dir * 28;
          car.angle = car.dir > 0 ? 0 : Math.PI;
        } else {
          car.axis = 'v';
          car.road = r;
          car.dir = random() < 0.5 ? 1 : -1;
          car.x = r + car.dir * 28;
          car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        }
        break;
      }
    }
    if (car.axis === 'v') {
      if (car.y < 60) { car.y = WORLD.height - 60; }
      if (car.y > WORLD.height - 60) { car.y = 60; }
      car.x = car.road + car.dir * 28;
    } else {
      if (car.x < 60) { car.x = WORLD.width - 60; }
      if (car.x > WORLD.width - 60) { car.x = 60; }
      car.y = car.road + car.dir * 28;
    }
  }

  function stepPolice(dt, car) {
    const p = state.player;
    const targetAngle = angleTo(car.x, car.y, p.x, p.y);
    car.angle += clamp(angleDiff(car.angle, targetAngle), -3.2 * dt, 3.2 * dt);
    const d = dist(car.x, car.y, p.x, p.y);
    const want = d > 90 ? CAR.policeSpeed : CAR.policeSpeed * 0.7;
    car.speed += clamp(want - car.speed, -500 * dt, 320 * dt);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.x = clamp(car.x, 40, WORLD.width - 40);
    car.y = clamp(car.y, 40, WORLD.height - 40);
    if (pushOutOfBuildings(car, 20)) car.speed *= 0.4;
    // Ram the player.
    const pr = p.car ? 26 : PLAYER.radius;
    if (dist(car.x, car.y, p.x, p.y) < 24 + pr && p.ramCd <= 0) {
      p.health -= p.car ? 9 : 14;
      p.ramCd = 0.6;
      if (p.car) p.car.speed *= 0.55;
      return EVENT_HIT;
    }
    return 0;
  }

  function stepPeds(dt) {
    for (const ped of state.peds) {
      if (ped.down) {
        ped.downTimer -= dt;
        if (ped.downTimer <= 0) {
          const spot = randomSidewalkSpot();
          ped.x = spot.x;
          ped.y = spot.y;
          ped.down = false;
        }
        continue;
      }
      if (ped.waitTimer > 0) {
        ped.waitTimer -= dt;
        continue;
      }
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        const spot = randomSidewalkSpot();
        ped.tx = spot.x;
        ped.ty = spot.y;
        ped.waitTimer = 0.5 + random() * 2;
        continue;
      }
      ped.angle = angleTo(ped.x, ped.y, ped.tx, ped.ty);
      ped.x += Math.cos(ped.angle) * ped.speed * dt;
      ped.y += Math.sin(ped.angle) * ped.speed * dt;
      if (!onRoad(ped.x, ped.y)) pushOutOfBuildings(ped, 10);
    }
  }

  function stepPlayer(dt, input) {
    const p = state.player;
    if (p.punchCd > 0) p.punchCd -= dt;
    if (p.shootCd > 0) p.shootCd -= dt;
    if (p.ramCd > 0) p.ramCd -= dt;

    if (input.enter) {
      if (p.car) {
        // Step out beside the car.
        const car = p.car;
        p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 34;
        p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 34;
        p.angle = car.angle;
        car.speed = 0;
        car.kind = 'parked';
        p.car = null;
        p.speed = 0;
      } else {
        const car = nearestStealableCar();
        if (car) {
          p.car = car;
          car.kind = 'player';
          if (!car.stolen) {
            car.stolen = true;
            if (raiseWanted(1)) state.message = 'Car stolen! Wanted level up.';
          }
        }
      }
    }

    if (p.car) {
      const car = p.car;
      const forward = input.my < 0;
      const back = input.my > 0;
      if (forward) car.speed += CAR.accel * dt;
      else if (back) {
        if (car.speed > 10) car.speed -= CAR.brake * dt;
        else car.speed -= CAR.reverseAccel * dt;
      } else {
        car.speed -= car.speed * CAR.drag * dt;
        if (Math.abs(car.speed) < 4) car.speed = 0;
      }
      car.speed = clamp(car.speed, -CAR.maxReverse, CAR.maxSpeed);
      const steer = input.mx * (car.speed >= 0 ? 1 : -1);
      car.angle += steer * CAR.turnRate * clamp(Math.abs(car.speed) / 160, 0, 1) * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      car.x = clamp(nx, 40, WORLD.width - 40);
      car.y = clamp(ny, 40, WORLD.height - 40);
      if (pushOutOfBuildings(car, 20)) {
        car.speed *= 0.45;
        if (Math.abs(car.speed) > 200) {
          p.health -= 2;
        }
      }
      p.x = car.x;
      p.y = car.y;
      p.angle = car.angle;
      p.speed = Math.abs(car.speed);
      // Hitting pedestrians while driving.
      for (const ped of state.peds) {
        if (ped.down) continue;
        if (dist(car.x, car.y, ped.x, ped.y) < 26 && Math.abs(car.speed) > 60) {
          ped.down = true;
          ped.downTimer = 4;
          car.speed *= 0.6;
          if (raiseWanted(1)) return EVENT_WANTED;
        }
      }
    } else {
      const vx = input.mx * PLAYER.walkSpeed;
      const vy = input.my * PLAYER.walkSpeed;
      if (vx !== 0 || vy !== 0) p.angle = Math.atan2(vy, vx);
      p.x = clamp(p.x + vx * dt, 30, WORLD.width - 30);
      p.y = clamp(p.y + vy * dt, 30, WORLD.height - 30);
      pushOutOfBuildings(p, PLAYER.radius);
      p.speed = Math.hypot(vx, vy);
    }

    if (input.attack) {
      if (p.car) {
        if (p.shootCd <= 0) {
          p.shootCd = PLAYER.shootCooldown;
          state.bullets.push({ x: p.x + Math.cos(p.angle) * 30, y: p.y + Math.sin(p.angle) * 30, angle: p.angle, life: 0.9 });
        }
      } else if (p.punchCd <= 0) {
        p.punchCd = PLAYER.punchCooldown;
        let hit = false;
        for (const ped of state.peds) {
          if (ped.down) continue;
          if (dist(p.x, p.y, ped.x, ped.y) < PLAYER.punchRange) {
            ped.down = true;
            ped.downTimer = 4;
            hit = true;
          }
        }
        if (hit && raiseWanted(1)) return EVENT_WANTED;
        if (!hit) {
          p.shootCd = PLAYER.shootCooldown;
          state.bullets.push({ x: p.x + Math.cos(p.angle) * 20, y: p.y + Math.sin(p.angle) * 20, angle: p.angle, life: 0.9 });
        }
      }
    }
    return 0;
  }

  function stepBullets(dt) {
    let events = 0;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += Math.cos(b.angle) * PLAYER.bulletSpeed * dt;
      b.y += Math.sin(b.angle) * PLAYER.bulletSpeed * dt;
      b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > WORLD.width || b.y > WORLD.height;
      if (!dead) {
        for (const ped of state.peds) {
          if (!ped.down && dist(b.x, b.y, ped.x, ped.y) < 14) {
            ped.down = true;
            ped.downTimer = 5;
            dead = true;
            if (raiseWanted(1)) events |= EVENT_WANTED;
            break;
          }
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.kind === 'police' && dist(b.x, b.y, car.x, car.y) < 26) {
            car.hp -= 34;
            dead = true;
            if (car.hp <= 0) {
              car.hp = 0;
              car.kind = 'wreck';
              state.cash += 25;
              state.saveDirty = true;
              if (raiseWanted(1)) events |= EVENT_WANTED;
            }
            break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return events;
  }

  function step(dt, input, attract) {
    let events = 0;
    state.elapsed += dt;
    if (state.messageTimer > 0) state.messageTimer -= dt;
    if (state.speedCooldown > 0) state.speedCooldown -= dt;

    for (const car of state.cars) stepTraffic(dt, car);
    stepPeds(dt);

    if (attract) return 0;

    events |= stepPlayer(dt, input);
    events |= stepBullets(dt);

    // Car-to-car separation (cheap pairwise push for a small pool).
    const cars = state.cars;
    for (let i = 0; i < cars.length; i += 1) {
      for (let j = i + 1; j < cars.length; j += 1) {
        const a = cars[i];
        const b = cars[j];
        if (a.kind === 'wreck' || b.kind === 'wreck') continue;
        const d = dist(a.x, a.y, b.x, b.y);
        if (d > 0.01 && d < 40) {
          const push = (40 - d) / 2;
          const nx = (b.x - a.x) / d;
          const ny = (b.y - a.y) / d;
          if (a.kind !== 'player') { a.x -= nx * push; a.y -= ny * push; }
          if (b.kind !== 'player') { b.x += nx * push; b.y += ny * push; }
        }
      }
    }

    // Police: keep one patrol car per wanted star.
    const police = cars.filter((c) => c.kind === 'police');
    if (state.wanted > police.length) {
      const car = spawnPolice();
      cars.push(car);
    } else if (state.wanted === 0 && police.length > 0) {
      for (let i = cars.length - 1; i >= 0; i -= 1) {
        if (cars[i].kind === 'police') cars.splice(i, 1);
      }
    }
    for (const car of cars) {
      if (car.kind === 'police') events |= stepPolice(dt, car);
    }

    // Speeding past a patrol car raises the heat.
    const p = state.player;
    if (p.car && p.speed > 330 && state.speedCooldown <= 0) {
      for (const car of cars) {
        if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 420) {
          if (raiseWanted(1)) events |= EVENT_WANTED;
          state.speedCooldown = 6;
          break;
        }
      }
    }

    // Busted: a cop sits on you while you are slow or on foot.
    let copNear = false;
    for (const car of cars) {
      if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 52) copNear = true;
    }
    if (copNear && p.speed < 40) {
      state.bustTimer += dt;
      if (state.bustTimer > 1.6) {
        state.over = 'busted';
        return events | EVENT_OVER;
      }
    } else {
      state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
    }

    // Wanted decays once no cop can see you.
    let copSees = false;
    for (const car of cars) {
      if (car.kind === 'police' && dist(car.x, car.y, p.x, p.y) < 620) copSees = true;
    }
    if (state.wanted > 0 && !copSees) {
      state.decayTimer += dt;
      if (state.decayTimer > 5) {
        state.decayTimer = 0;
        state.wanted -= 1;
        state.message = state.wanted === 0 ? 'You lost the cops. Clean.' : `Wanted level ${state.wanted}★`;
        state.messageTimer = 2;
      }
    } else {
      state.decayTimer = 0;
    }

    // Slow health regen while clean.
    if (state.wanted === 0 && p.health < PLAYER.health && p.ramCd <= 0) {
      p.health = Math.min(PLAYER.health, p.health + 2 * dt);
    }
    if (p.health <= 0) {
      p.health = 0;
      state.over = 'wasted';
      return events | EVENT_OVER;
    }

    // Packages.
    if (state.missionIndex < MISSIONS.length && MISSIONS[state.missionIndex].id === 'packages') {
      for (const pkg of state.packages) {
        if (!pkg.taken && dist(p.x, p.y, pkg.x, pkg.y) < 34) {
          pkg.taken = true;
          state.packagesGot += 1;
          state.cash += 50;
          state.saveDirty = true;
          state.message = `Package ${state.packagesGot}/5 collected — +$50`;
          state.messageTimer = 2;
        }
      }
    }

    // Mission completion.
    if (state.missionIndex < MISSIONS.length) {
      const m = MISSIONS[state.missionIndex];
      if (m.id === 'steal' && p.car && p.car.stolen && dist(p.x, p.y, chopShop.x, chopShop.y) < chopShop.r) {
        events |= completeMission();
      } else if (m.id === 'heat' && state.maxWanted >= 3 && state.wanted === 0) {
        events |= completeMission();
      } else if (m.id === 'packages' && state.packagesGot >= 5) {
        events |= completeMission();
      }
    }

    updateTarget();
    return events;
  }

  reset();
  return { state, reset, step, loadProgress, nearestStealableCar };
}

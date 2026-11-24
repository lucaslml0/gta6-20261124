// Drawing only: the world's state and the current screen in, pixels out. The 1280x720 logical
// view is scaled to fit the window and centred; the camera follows the player through the city.
// Flat shapes and canvas text for the world, HUD, minimap and panels.
import { CAR, COLORS, MISSIONS, PLAYER, ROAD_HALF, ROAD_SPACING, ROAD_WIDTH, VIEW, WORLD } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
const MAP = { x: VIEW.width - 200, y: 16, w: 184, h: 138 };

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  /** Convert a client (CSS pixel) pointer position into logical 1280x720 coordinates. */
  function toLogical(clientX, clientY) {
    const rect = canvas.getBoundingClientRect();
    const px = ((clientX - rect.left) / rect.width) * canvas.width;
    const py = ((clientY - rect.top) / rect.height) * canvas.height;
    return { x: (px - view.x) / view.scale, y: (py - view.y) / view.scale };
  }

  function text(value, x, y, size, color, align, baseline) {
    if (!fonts.has(size)) fonts.set(size, `bold ${size}px ${FONT}`);
    context.font = fonts.get(size);
    context.fillStyle = color;
    context.textAlign = align || 'left';
    context.textBaseline = baseline || 'alphabetic';
    context.fillText(value, x, y);
  }

  function camera(state) {
    const p = state.player;
    return {
      x: Math.max(0, Math.min(WORLD.width - VIEW.width, p.x - VIEW.width / 2)),
      y: Math.max(0, Math.min(WORLD.height - VIEW.height, p.y - VIEW.height / 2)),
    };
  }

  function drawWorld(state) {
    const cam = camera(state);
    const x0 = cam.x - 60;
    const y0 = cam.y - 60;
    const x1 = cam.x + VIEW.width + 60;
    const y1 = cam.y + VIEW.height + 60;
    context.save();
    context.translate(-cam.x, -cam.y);
    context.fillStyle = COLORS.grass;
    context.fillRect(x0, y0, x1 - x0, y1 - y0);

    for (const park of state.parks) {
      context.fillStyle = COLORS.park;
      context.fillRect(park.x, park.y, park.w, park.h);
      context.fillStyle = '#2c6e31';
      for (let i = 0; i < 5; i += 1) {
        const tx = park.x + 20 + ((i * 53) % Math.max(20, park.w - 40));
        const ty = park.y + 20 + ((i * 37) % Math.max(20, park.h - 40));
        context.beginPath();
        context.arc(tx, ty, 12, 0, Math.PI * 2);
        context.fill();
      }
    }

    // Sidewalks and roads.
    context.fillStyle = COLORS.sidewalk;
    for (const rx of state.roadsV) context.fillRect(rx - ROAD_HALF - 14, y0, ROAD_WIDTH + 28, y1 - y0);
    for (const ry of state.roadsH) context.fillRect(x0, ry - ROAD_HALF - 14, x1 - x0, ROAD_WIDTH + 28);
    context.fillStyle = COLORS.road;
    for (const rx of state.roadsV) context.fillRect(rx - ROAD_HALF, y0, ROAD_WIDTH, y1 - y0);
    for (const ry of state.roadsH) context.fillRect(x0, ry - ROAD_HALF, x1 - x0, ROAD_WIDTH);
    // Lane dashes.
    context.fillStyle = COLORS.lane;
    for (const rx of state.roadsV) {
      for (let y = Math.floor(y0 / 44) * 44; y < y1; y += 44) context.fillRect(rx - 2, y, 4, 22);
    }
    for (const ry of state.roadsH) {
      for (let x = Math.floor(x0 / 44) * 44; x < x1; x += 44) context.fillRect(x, ry - 2, 22, 4);
    }

    // Chop shop zone.
    const chop = state.chopShop;
    context.fillStyle = 'rgba(255,210,63,0.25)';
    context.beginPath();
    context.arc(chop.x, chop.y, chop.r, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = COLORS.chopshop;
    context.lineWidth = 3;
    context.beginPath();
    context.arc(chop.x, chop.y, chop.r, 0, Math.PI * 2);
    context.stroke();
    text('CHOP SHOP', chop.x, chop.y - chop.r - 8, 16, COLORS.chopshop, 'center');

    // Buildings.
    for (const b of state.buildings) {
      if (b.x > x1 || b.y > y1 || b.x + b.w < x0 || b.y + b.h < y0) continue;
      context.fillStyle = b.color;
      context.fillRect(b.x, b.y, b.w, b.h);
      context.fillStyle = b.roof;
      context.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      context.fillStyle = 'rgba(255,255,180,0.5)';
      for (let wx = b.x + 16; wx < b.x + b.w - 14; wx += 26) {
        for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 26) context.fillRect(wx, wy, 8, 10);
      }
    }

    // Packages.
    for (const pkg of state.packages) {
      if (pkg.taken) continue;
      context.fillStyle = COLORS.package;
      context.fillRect(pkg.x - 9, pkg.y - 9, 18, 18);
      context.strokeStyle = '#ffffff';
      context.lineWidth = 2;
      context.strokeRect(pkg.x - 9, pkg.y - 9, 18, 18);
    }

    // Cars.
    for (const car of state.cars) drawCar(car);
    // Pedestrians.
    for (const ped of state.peds) {
      context.save();
      context.translate(ped.x, ped.y);
      if (ped.down) {
        context.rotate(ped.angle + Math.PI / 2);
        context.fillStyle = ped.color;
        context.fillRect(-11, -4, 22, 8);
      } else {
        context.fillStyle = ped.color;
        context.beginPath();
        context.arc(0, 0, 8, 0, Math.PI * 2);
        context.fill();
        context.fillStyle = '#222';
        context.beginPath();
        context.arc(Math.cos(ped.angle) * 4, Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
        context.fill();
      }
      context.restore();
    }
    // Bullets.
    context.fillStyle = '#ffe14d';
    for (const b of state.bullets) {
      context.beginPath();
      context.arc(b.x, b.y, 4, 0, Math.PI * 2);
      context.fill();
    }
    // Player.
    const p = state.player;
    if (!p.car) drawPlayer(p);
    context.restore();
    return cam;
  }

  function drawCar(car) {
    context.save();
    context.translate(car.x, car.y);
    context.rotate(car.angle);
    context.fillStyle = car.kind === 'wreck' ? '#3a3a3a' : car.color;
    context.fillRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width);
    context.fillStyle = car.kind === 'police' ? '#ffffff' : 'rgba(20,20,30,0.75)';
    context.fillRect(-6, -CAR.width / 2 + 3, 16, CAR.width - 6);
    if (car.kind === 'police') {
      context.fillStyle = '#ff3b30';
      context.fillRect(-CAR.length / 2 + 2, -CAR.width / 2, 8, 6);
      context.fillStyle = '#3b82ff';
      context.fillRect(-CAR.length / 2 + 2, CAR.width / 2 - 6, 8, 6);
      context.fillStyle = '#ffffff';
      context.fillRect(-2, -CAR.width / 2, 6, CAR.width);
    }
    context.restore();
  }

  function drawPlayer(p) {
    context.save();
    context.translate(p.x, p.y);
    context.rotate(p.angle);
    context.fillStyle = COLORS.player;
    context.beginPath();
    context.arc(0, 0, PLAYER.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#1c1c22';
    context.fillRect(6, -5, 12, 10);
    context.restore();
  }

  function drawMinimap(state) {
    const sx = MAP.w / WORLD.width;
    const sy = MAP.h / WORLD.height;
    context.fillStyle = COLORS.hudBg;
    context.fillRect(MAP.x - 4, MAP.y - 4, MAP.w + 8, MAP.h + 8);
    context.fillStyle = '#1d2b1d';
    context.fillRect(MAP.x, MAP.y, MAP.w, MAP.h);
    context.strokeStyle = '#3a3a40';
    context.lineWidth = 1;
    for (const rx of state.roadsV) {
      context.beginPath();
      context.moveTo(MAP.x + rx * sx, MAP.y);
      context.lineTo(MAP.x + rx * sx, MAP.y + MAP.h);
      context.stroke();
    }
    for (const ry of state.roadsH) {
      context.beginPath();
      context.moveTo(MAP.x, MAP.y + ry * sy);
      context.lineTo(MAP.x + MAP.w, MAP.y + ry * sy);
      context.stroke();
    }
    if (state.target) {
      context.fillStyle = state.target.color;
      context.beginPath();
      context.arc(MAP.x + state.target.x * sx, MAP.y + state.target.y * sy, 5, 0, Math.PI * 2);
      context.fill();
    }
    for (const car of state.cars) {
      if (car.kind !== 'police') continue;
      context.fillStyle = '#5aa0ff';
      context.fillRect(MAP.x + car.x * sx - 2, MAP.y + car.y * sy - 2, 4, 4);
    }
    const p = state.player;
    context.fillStyle = COLORS.player;
    context.beginPath();
    context.arc(MAP.x + p.x * sx, MAP.y + p.y * sy, 4, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#ffffff';
    context.lineWidth = 1;
    context.beginPath();
    context.arc(MAP.x + p.x * sx, MAP.y + p.y * sy, 5.5, 0, Math.PI * 2);
    context.stroke();
  }

  function drawHud(state) {
    const p = state.player;
    context.fillStyle = COLORS.hudBg;
    context.fillRect(12, 12, 300, 96);
    // Health bar.
    context.fillStyle = '#3a3a42';
    context.fillRect(24, 24, 180, 16);
    context.fillStyle = p.health > 40 ? '#39d353' : '#e5534b';
    context.fillRect(24, 24, 180 * (p.health / PLAYER.health), 16);
    text(`HP ${Math.ceil(p.health)}`, 212, 38, 15, '#ffffff', 'left', 'middle');
    text(`$${state.cash}`, 24, 66, 22, '#7CFC9A', 'left', 'middle');
    // Wanted stars.
    let stars = '';
    for (let i = 0; i < 5; i += 1) stars += i < state.wanted ? '★' : '☆';
    text(stars, 24, 96, 24, COLORS.star, 'left', 'middle');
    // Mission objective.
    const m = MISSIONS[state.missionIndex];
    context.fillStyle = COLORS.hudBg;
    context.fillRect(12, VIEW.height - 64, 560, 52);
    if (m) {
      text(m.title, 24, VIEW.height - 44, 17, '#ffffff', 'left', 'middle');
      text(m.short, 24, VIEW.height - 22, 15, '#c9c9d1', 'left', 'middle');
    } else {
      text('All missions complete — you own the city.', 24, VIEW.height - 34, 17, '#7CFC9A', 'left', 'middle');
    }
    // Message banner.
    if (state.messageTimer > 0 && state.message) {
      context.fillStyle = COLORS.hudBg;
      const w = Math.min(760, 40 + state.message.length * 10);
      context.fillRect((VIEW.width - w) / 2, 116, w, 40);
      text(state.message, VIEW.width / 2, 142, 19, '#ffffff', 'center', 'middle');
    }
    // Controls hint.
    text('WASD move · E enter/exit car · Space punch/shoot · P pause', VIEW.width - 16, VIEW.height - 16, 14, 'rgba(255,255,255,0.65)', 'right', 'middle');
    // Busted warning.
    if (state.bustTimer > 0.3) {
      text('BUSTED — break away!', VIEW.width / 2, 190, 26, '#ff5b4d', 'center', 'middle');
    }
    drawMinimap(state);
  }

  function button(label, x, y, w, h, accent) {
    context.fillStyle = accent ? '#e33f2f' : '#2c2c34';
    context.fillRect(x, y, w, h);
    context.strokeStyle = accent ? '#ffd23f' : '#55555e';
    context.lineWidth = 2;
    context.strokeRect(x, y, w, h);
    text(label, x + w / 2, y + h / 2 + 7, 22, '#ffffff', 'center', 'middle');
    return { x, y, w, h };
  }

  function drawTitle(state, save) {
    drawWorld(state);
    context.fillStyle = 'rgba(8,8,14,0.55)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('VICE CITY', VIEW.width / 2, 150, 84, '#ffd23f', 'center', 'middle');
    text('NIGHTS', VIEW.width / 2, 222, 84, '#ffffff', 'center', 'middle');
    text('An open-world crime story in your browser.', VIEW.width / 2, 278, 22, '#e8e8ee', 'center', 'middle');
    text('Three jobs. One city. Steal the car, lose the cops, run the packages —', VIEW.width / 2, 312, 18, '#c9c9d1', 'center', 'middle');
    text('and take the $1,900 on the table.', VIEW.width / 2, 336, 18, '#c9c9d1', 'center', 'middle');
    text('WASD / arrows — move & drive · E — steal / exit car · Space — punch / shoot · P — pause', VIEW.width / 2, 392, 17, '#ffffff', 'center', 'middle');
    const buttons = [];
    const bw = 260;
    const bh = 56;
    const cx = (VIEW.width - bw) / 2;
    buttons.push({ id: 'start', ...button('▶  START', cx, 440, bw, bh, true) });
    if (save && save.missionIndex > 0) {
      buttons.push({ id: 'continue', ...button(`CONTINUE — Mission ${save.missionIndex + 1} · $${save.cash}`, cx, 510, bw, bh, false) });
    }
    text('Progress saves to this browser automatically.', VIEW.width / 2, 600, 15, 'rgba(255,255,255,0.6)', 'center', 'middle');
    return buttons;
  }

  function drawOver(state) {
    drawWorld(state);
    context.fillStyle = 'rgba(8,8,14,0.6)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    let title = 'WASTED';
    let color = '#e5534b';
    let lines = [`Cash banked: $${state.cash}`, `Missions finished: ${state.missionIndex} / ${MISSIONS.length}`];
    if (state.over === 'busted') {
      title = 'BUSTED';
      lines = [`The cops caught you with $${state.cash} in your pocket.`, `Missions finished: ${state.missionIndex} / ${MISSIONS.length}`];
    } else if (state.over === 'complete') {
      title = 'YOU OWN THE CITY';
      color = '#39d353';
      lines = ['All three jobs done. The chop shop, the getaway, the packages —', `Final take: $${state.cash}. Vice City is yours.`];
    }
    text(title, VIEW.width / 2, 250, 64, color, 'center', 'middle');
    for (let i = 0; i < lines.length; i += 1) text(lines[i], VIEW.width / 2, 330 + i * 34, 22, '#ffffff', 'center', 'middle');
    text('Press Enter or click to play again', VIEW.width / 2, 470, 20, '#ffd23f', 'center', 'middle');
  }

  function drawPaused() {
    context.fillStyle = 'rgba(8,8,14,0.6)';
    context.fillRect(0, 0, VIEW.width, VIEW.height);
    text('PAUSED', VIEW.width / 2, VIEW.height / 2 - 20, 56, '#ffffff', 'center', 'middle');
    text('Press P to resume', VIEW.width / 2, VIEW.height / 2 + 40, 20, '#ffd23f', 'center', 'middle');
  }

  /** Paint one frame. Returns the title screen's clickable buttons (empty otherwise). */
  function draw(state, screen, save) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = '#11141b';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    if (screen === SCREEN_TITLE) return drawTitle(state, save);
    drawWorld(state);
    drawHud(state);
    if (screen === SCREEN_PAUSED) drawPaused();
    else if (screen === SCREEN_OVER) drawOver(state);
    return [];
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw, toLogical };
}

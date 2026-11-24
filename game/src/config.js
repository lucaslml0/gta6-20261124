// Vice City Nights — a top-down open-world crime game (make.fun gta6-01).
// Every tuning number and colour in one place. Logical canvas 1280x720; the world is a
// 3200x2400 city of roads, blocks, buildings and parks, drawn through a following camera.
export const STEP = 1 / 60;
export const VIEW = { width: 1280, height: 720 };
export const WORLD = { width: 3200, height: 2400 };
export const SAVE_KEY = 'vice-city-nights-save-v1';

export const ROAD_SPACING = 400;
export const ROAD_WIDTH = 110;
export const ROAD_HALF = ROAD_WIDTH / 2;

export const PLAYER = {
  radius: 13,
  walkSpeed: 210,
  health: 100,
  punchRange: 46,
  punchDamage: 34,
  punchCooldown: 0.35,
  shootCooldown: 0.28,
  bulletSpeed: 640,
};

export const CAR = {
  length: 46,
  width: 22,
  accel: 420,
  brake: 700,
  reverseAccel: 240,
  maxSpeed: 460,
  maxReverse: 150,
  turnRate: 2.6,
  drag: 0.55,
  trafficSpeed: 150,
  policeSpeed: 480,
};

export const MISSIONS = [
  {
    id: 'steal',
    title: '1 · Hot Wheels',
    short: 'Steal a car and deliver it to the chop shop',
    desc: 'Any car will do. Press E next to one to steal it, then drive into the yellow chop-shop zone on the east side of town.',
    reward: 500,
  },
  {
    id: 'heat',
    title: '2 · Clean Getaway',
    short: 'Reach a 3-star wanted level, then lose the heat',
    desc: 'The cops only respect heat. Steal cars, hit pedestrians, speed past patrol cars — get to 3 stars, then break line of sight until the stars fade.',
    reward: 800,
  },
  {
    id: 'packages',
    title: '3 · Package Run',
    short: 'Collect 5 packages around the city',
    desc: 'Five drops are stashed around town. Grab them all on foot or by car. Watch the minimap for the green markers.',
    reward: 600,
  },
];

export const COLORS = {
  grass: '#2e5d33',
  park: '#3a7a3f',
  sidewalk: '#8d8d94',
  road: '#2b2b31',
  lane: '#d8c95a',
  building: ['#7a6a8a', '#8a6a5a', '#5a7a8a', '#6a8a5a', '#9a8a6a', '#5a5a72'],
  buildingRoof: ['#5d526e', '#6e5546', '#48606e', '#546e48', '#7a6e54', '#48485e'],
  player: '#ffd23f',
  police: '#2f6fd8',
  package: '#39d353',
  chopshop: '#ffd23f',
  hudBg: 'rgba(10,10,16,0.72)',
  star: '#ffd23f',
  starEmpty: '#55555e',
  carColors: ['#e33f2f', '#3f7fe3', '#e3e3e3', '#39d353', '#e38a3f', '#b03fe3', '#3fd8e3'],
  pedColors: ['#e8e8e8', '#7fb3ff', '#ff9fb3', '#b3ff9f', '#ffd27f'],
};

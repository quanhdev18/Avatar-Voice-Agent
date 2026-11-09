/**
 * Arena definitions. Geometry here drives both the server physics and the
 * client drawing, so what you see is exactly what you stand on.
 * World is 1000 × 560, y grows downward, the floor line is GROUND.
 */
export const W = 1000;
export const H = 560;
export const GROUND = 470;
/** Lava surface sits a little below the floor line. */
export const LAVA_Y = GROUND + 14;

export const MAP_IDS = ['notebook', 'rooftop', 'volcano', 'dojo'] as const;
export type MapId = (typeof MAP_IDS)[number];
/** What a room can be set to: a map, or pick one at random when the match starts. */
export type MapChoice = MapId | 'random';

export type Platform = {
  x1: number;
  x2: number;
  y: number;
  /** Oscillates by ±dx / ±dy over `period` seconds. */
  move?: { dx: number; dy: number; period: number };
};

export type Span = { x1: number; x2: number };

export type MapDef = {
  id: MapId;
  name: string;
  desc: string;
  /** short gameplay hints shown in the picker */
  traits: string[];
  /** solid floor pieces at GROUND; gaps between them are pits (fall = K.O) */
  ground: Span[];
  /** lava pools at LAVA_Y: burn and bounce you up */
  lava: Span[];
  platforms: Platform[];
  /** invisible side walls */
  bounds: Span;
  /** periodic gusts that push everyone sideways */
  wind?: { period: number; duration: number; speed: number };
  /** spawn x positions; all must be above solid ground */
  spawns: { red: number[]; blue: number[]; ffa: number[] };
};

export const MAPS: Record<MapId, MapDef> = {
  notebook: {
    id: 'notebook',
    name: 'Trang vở',
    desc: 'Sàn liền, ba bục gỗ. Bản đồ cân bằng để làm quen.',
    traits: ['3 bục', 'Không bẫy'],
    ground: [{ x1: 0, x2: W }],
    lava: [],
    platforms: [
      { x1: 140, x2: 360, y: 340 },
      { x1: 640, x2: 860, y: 340 },
      { x1: 400, x2: 600, y: 215 },
    ],
    bounds: { x1: 30, x2: W - 30 },
    spawns: {
      red: [90, 150, 210, 270],
      blue: [910, 850, 790, 730],
      ffa: [80, 920, 250, 750, 420, 580, 160, 840],
    },
  },
  rooftop: {
    id: 'rooftop',
    name: 'Sân thượng',
    desc: 'Hai nóc nhà cách nhau một khe sâu. Có thang treo chạy qua lại và gió giật đẩy người.',
    traits: ['Vực giữa', 'Bục di động', 'Gió giật'],
    ground: [
      { x1: 0, x2: 370 },
      { x1: 630, x2: W },
    ],
    lava: [],
    platforms: [
      { x1: 110, x2: 250, y: 345 },
      { x1: 750, x2: 890, y: 345 },
      { x1: 445, x2: 555, y: 395, move: { dx: 95, dy: 0, period: 5 } },
      { x1: 430, x2: 570, y: 205 },
    ],
    bounds: { x1: 30, x2: W - 30 },
    wind: { period: 12, duration: 3, speed: 130 },
    spawns: {
      red: [80, 150, 220, 290],
      blue: [920, 850, 780, 710],
      ffa: [80, 920, 300, 700, 180, 820, 240, 760],
    },
  },
  volcano: {
    id: 'volcano',
    name: 'Núi lửa',
    desc: 'Hai bên là hồ dung nham: chạm vào là bỏng và bị hất tung. Bục giữa nhấp nhô.',
    traits: ['Dung nham', 'Bục lên xuống'],
    ground: [{ x1: 190, x2: 810 }],
    lava: [
      { x1: 0, x2: 190 },
      { x1: 810, x2: W },
    ],
    platforms: [
      { x1: 40, x2: 165, y: 330 },
      { x1: 835, x2: 960, y: 330 },
      { x1: 410, x2: 590, y: 260, move: { dx: 0, dy: 45, period: 6 } },
    ],
    bounds: { x1: 30, x2: W - 30 },
    spawns: {
      red: [240, 290, 340, 390],
      blue: [760, 710, 660, 610],
      ffa: [240, 760, 340, 660, 440, 560, 290, 710],
    },
  },
  dojo: {
    id: 'dojo',
    name: 'Võ đường',
    desc: 'Sàn gỗ phẳng, tường hai bên, không chỗ trốn. Đấu tay đôi thuần kỹ năng.',
    traits: ['Sàn hẹp', 'Không bục'],
    ground: [{ x1: 0, x2: W }],
    lava: [],
    platforms: [],
    bounds: { x1: 150, x2: W - 150 },
    spawns: {
      red: [230, 280, 330, 380],
      blue: [770, 720, 670, 620],
      ffa: [220, 780, 340, 660, 450, 550, 280, 720],
    },
  },
};

export const getMap = (id: MapId): MapDef => MAPS[id];

export function resolveMapChoice(c: MapChoice, rand: () => number = Math.random): MapId {
  return c === 'random' ? MAP_IDS[Math.floor(rand() * MAP_IDS.length)]! : c;
}

/** Platform position at time t (seconds). */
export function platformAt(p: Platform, t: number): { x1: number; x2: number; y: number } {
  if (!p.move) return p;
  const s = Math.sin((2 * Math.PI * t) / p.move.period);
  return { x1: p.x1 + p.move.dx * s, x2: p.x2 + p.move.dx * s, y: p.y + p.move.dy * s };
}

/** Wind push in px/s at time t: 0 when calm, ± speed during a gust (direction alternates). */
export function windAt(map: MapDef, t: number): number {
  const w = map.wind;
  if (!w || t < 0) return 0;
  const cycle = Math.floor(t / w.period);
  const phase = t - cycle * w.period;
  if (phase < w.period - w.duration) return 0;
  return cycle % 2 === 0 ? w.speed : -w.speed;
}

/** Seconds until the next gust starts (0 while blowing), and its direction. */
export function nextGust(map: MapDef, t: number): { inSec: number; dir: 1 | -1 } | null {
  const w = map.wind;
  if (!w) return null;
  const cycle = Math.floor(Math.max(0, t) / w.period);
  const start = cycle * w.period + (w.period - w.duration);
  const dir = cycle % 2 === 0 ? 1 : -1;
  if (t >= start) return { inSec: 0, dir };
  return { inSec: start - t, dir };
}

export const inSpan = (spans: Span[], x: number) => spans.some((s) => x >= s.x1 && x <= s.x2);

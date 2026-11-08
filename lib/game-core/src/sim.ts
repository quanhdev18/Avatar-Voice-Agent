/**
 * Shared fight simulation. The server runs it authoritatively; the client
 * runs the same code for the offline demo and to predict its own fighter.
 * All state is plain data so it can be cloned and sent over the wire.
 */
import type { Accessory, Weapon } from './cosmetics';

export const W = 1000;
export const H = 560;
export const GROUND = 470;
export const PLATFORMS = [
  { x1: 140, x2: 360, y: 340 },
  { x1: 640, x2: 860, y: 340 },
  { x1: 400, x2: 600, y: 215 },
] as const;

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const MATCH_SEC = 180;
export const INTRO_SEC = 1.6;
export const RESPAWN_SEC = 3;

const GRAVITY = 1700;
const SPEED = 260;
const JUMP = 720;

export type Mode = 'team' | 'ffa';
export const TEAMS = ['red', 'blue'] as const;
export type TeamId = (typeof TEAMS)[number];

export const winScore = (mode: Mode) => (mode === 'team' ? 10 : 5);

export type Action = 'none' | 'punch' | 'kick' | 'block' | 'super';

export const ATTACK = {
  punch: { dur: 0.3, hitAt: 0.1, range: 64, dmg: 7, knock: 180, cd: 0.32 },
  kick: { dur: 0.45, hitAt: 0.18, range: 80, dmg: 11, knock: 280, cd: 0.5 },
  super: { dur: 0.6, hitAt: 0.22, range: 170, dmg: 26, knock: 620, cd: 0.6 },
} as const;

export const WEAPON_MOD: Record<Weapon, { dmg: number; range: number; speed: number }> = {
  none: { dmg: 1, range: 0, speed: 1 },
  sword: { dmg: 1.25, range: 14, speed: 1 },
  staff: { dmg: 1.05, range: 30, speed: 1.1 },
  hammer: { dmg: 1.5, range: 10, speed: 1.3 },
};

export type Fighter = {
  id: string;
  name: string;
  /** 'red' | 'blue' in team mode; the fighter's own id in free-for-all */
  team: string;
  color: string;
  accessory: Accessory;
  weapon: Weapon;
  bot: boolean;
  spawn: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  hp: number;
  energy: number;
  action: Action;
  actionT: number;
  hitDone: boolean;
  hurtT: number;
  koT: number;
  cooldown: number;
  kos: number;
  falls: number;
  damage: number;
};

export type Input = {
  move: -1 | 0 | 1;
  jump: boolean;
  block: boolean;
  punch: boolean;
  kick: boolean;
  super: boolean;
};

export const NO_INPUT: Input = { move: 0, jump: false, block: false, punch: false, kick: false, super: false };

/* Compact wire format for inputs: one small integer. */
export function packInput(i: Input): number {
  return (
    (i.move < 0 ? 1 : 0) |
    (i.move > 0 ? 2 : 0) |
    (i.jump ? 4 : 0) |
    (i.block ? 8 : 0) |
    (i.punch ? 16 : 0) |
    (i.kick ? 32 : 0) |
    (i.super ? 64 : 0)
  );
}
export function unpackInput(b: number): Input {
  const l = (b & 1) !== 0;
  const r = (b & 2) !== 0;
  return {
    move: l === r ? 0 : l ? -1 : 1,
    jump: (b & 4) !== 0,
    block: (b & 8) !== 0,
    punch: (b & 16) !== 0,
    kick: (b & 32) !== 0,
    super: (b & 64) !== 0,
  };
}
/** The same input with one-shot attack presses removed (used when repeating a held input). */
export const heldOnly = (i: Input): Input => ({ ...i, punch: false, kick: false, super: false });

export type GameEvent =
  | { k: 'hit'; a: string; v: string; x: number; y: number; blocked: boolean; big: boolean }
  | { k: 'ko'; a: string; v: string }
  | { k: 'super'; a: string; x: number; y: number };

export type Match = {
  mode: Mode;
  /** match length in seconds */
  duration: number;
  tick: number;
  timeLeft: number;
  intro: number;
  fighters: Fighter[];
  score: Record<string, number>;
  ended: boolean;
  /** team id (or fighter id in ffa), 'draw', or null while running */
  winner: string | null;
};

export type RosterEntry = {
  id: string;
  name: string;
  team: string;
  color: string;
  accessory: Accessory;
  weapon: Weapon;
  bot: boolean;
};

/* ------------------------------------------------------------------ */
/* Setup                                                               */
/* ------------------------------------------------------------------ */
export function spawnPos(mode: Mode, team: string, spawn: number): { x: number; y: number; facing: 1 | -1 } {
  if (mode === 'team') {
    const red = team === 'red';
    return { x: red ? 90 + (spawn % 4) * 60 : W - 90 - (spawn % 4) * 60, y: GROUND, facing: red ? 1 : -1 };
  }
  const slots = [80, 920, 250, 750, 420, 580, 160, 840];
  const x = slots[spawn % slots.length]!;
  return { x, y: GROUND, facing: x < W / 2 ? 1 : -1 };
}

export function createMatch(mode: Mode, roster: RosterEntry[], duration = MATCH_SEC): Match {
  const m: Match = { mode, duration, tick: 0, timeLeft: duration, intro: INTRO_SEC, fighters: [], score: {}, ended: false, winner: null };
  for (const r of roster) addFighter(m, r);
  return m;
}

export function addFighter(m: Match, r: RosterEntry): Fighter {
  const team = m.mode === 'team' ? r.team : r.id;
  const used = new Set(m.fighters.filter((f) => m.mode === 'ffa' || f.team === team).map((f) => f.spawn));
  let spawn = 0;
  while (used.has(spawn)) spawn++;
  const p = spawnPos(m.mode, team, spawn);
  const f: Fighter = {
    ...r,
    team,
    spawn,
    x: p.x,
    y: p.y,
    vx: 0,
    vy: 0,
    facing: p.facing,
    onGround: true,
    hp: 100,
    energy: 0,
    action: 'none',
    actionT: 0,
    hitDone: false,
    hurtT: 0,
    koT: 0,
    cooldown: 0,
    kos: 0,
    falls: 0,
    damage: 0,
  };
  m.fighters.push(f);
  m.score[team] ??= 0;
  return f;
}

export function removeFighter(m: Match, id: string) {
  m.fighters = m.fighters.filter((f) => f.id !== id);
}

/* ------------------------------------------------------------------ */
/* Per-fighter step (movement, actions, physics — no hit resolution)   */
/* ------------------------------------------------------------------ */
function tryStart(f: Fighter, a: 'punch' | 'kick' | 'super', events: GameEvent[] | null) {
  if (f.action !== 'none' && f.action !== 'block') return;
  if (f.cooldown > 0 || f.hurtT > 0) return;
  if (a === 'super') {
    if (f.energy < 100) return;
    f.energy = 0;
    events?.push({ k: 'super', a: f.id, x: Math.round(f.x), y: Math.round(f.y - 45) });
  }
  f.action = a;
  f.actionT = 0;
  f.hitDone = false;
}

const attackSpec = (f: Fighter) =>
  f.action === 'punch' || f.action === 'kick' || f.action === 'super' ? ATTACK[f.action] : null;

function stepFighter(m: Pick<Match, 'mode'>, f: Fighter, input: Input, dt: number, events: GameEvent[] | null) {
  f.cooldown = Math.max(0, f.cooldown - dt);
  f.hurtT = Math.max(0, f.hurtT - dt);

  if (f.koT > 0) {
    f.koT -= dt;
    f.vx *= 0.9;
    if (f.koT <= 0) {
      const p = spawnPos(m.mode, f.team, f.spawn);
      Object.assign(f, { koT: 0, hp: 100, x: p.x, y: 0, vx: 0, vy: 0, facing: p.facing, action: 'none', hurtT: 0, onGround: false });
    }
  } else {
    if (input.punch) tryStart(f, 'punch', events);
    if (input.kick) tryStart(f, 'kick', events);
    if (input.super) tryStart(f, 'super', events);

    if (input.block && f.action === 'none' && f.onGround && f.hurtT <= 0) f.action = 'block';
    if (!input.block && f.action === 'block') f.action = 'none';

    const busy = f.hurtT > 0 || (f.action !== 'none' && f.action !== 'block');
    if (!busy) {
      const speed = f.action === 'block' ? SPEED * 0.25 : SPEED;
      f.vx += (input.move * speed - f.vx) * Math.min(1, dt * 14);
      if (input.move) f.facing = input.move;
      if (input.jump && f.onGround) {
        f.vy = -JUMP;
        f.onGround = false;
        if (f.action === 'block') f.action = 'none';
      }
    } else {
      f.vx *= Math.pow(0.02, dt);
    }
    if (attackSpec(f)) f.actionT += dt;
  }

  // physics
  const prevY = f.y;
  f.vy += GRAVITY * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.onGround = false;
  if (f.y >= GROUND) {
    f.y = GROUND;
    f.vy = 0;
    f.onGround = true;
  } else if (f.vy > 0) {
    for (const p of PLATFORMS) {
      if (prevY <= p.y && f.y >= p.y && f.x >= p.x1 && f.x <= p.x2) {
        f.y = p.y;
        f.vy = 0;
        f.onGround = true;
      }
    }
  }
  if (f.x < 30) {
    f.x = 30;
    f.vx = Math.abs(f.vx) * 0.3;
  }
  if (f.x > W - 30) {
    f.x = W - 30;
    f.vx = -Math.abs(f.vx) * 0.3;
  }
}

const hitDue = (f: Fighter) => {
  const spec = attackSpec(f);
  return !!spec && !f.hitDone && f.actionT >= spec.hitAt * WEAPON_MOD[f.weapon].speed;
};

function finishAction(f: Fighter) {
  const spec = attackSpec(f);
  if (spec && f.actionT >= spec.dur * WEAPON_MOD[f.weapon].speed) {
    f.action = 'none';
    f.cooldown = spec.cd;
  }
}

/**
 * Client-side prediction for the local fighter: same movement and
 * action timing as the server, but hits are left to the server.
 */
export function predictStep(mode: Mode, f: Fighter, input: Input, dt = DT) {
  if (f.koT > 0) return;
  stepFighter({ mode }, f, input, dt, null);
  if (hitDue(f)) f.hitDone = true;
  finishAction(f);
}

/* ------------------------------------------------------------------ */
/* Whole-match step                                                     */
/* ------------------------------------------------------------------ */
function resolveHit(m: Match, f: Fighter, events: GameEvent[], rand: () => number) {
  f.hitDone = true;
  const action = f.action as 'punch' | 'kick' | 'super';
  const spec = ATTACK[action];
  const mod = WEAPON_MOD[f.weapon];
  for (const o of m.fighters) {
    if (o.team === f.team || o.koT > 0) continue;
    const dx = o.x - f.x;
    const inFront = action === 'super' || Math.sign(dx) === f.facing || Math.abs(dx) < 8;
    if (!inFront || Math.abs(dx) > spec.range + mod.range || Math.abs(o.y - f.y) > 60) continue;
    const dir = Math.sign(dx) || f.facing;
    const blocked = o.action === 'block' && o.facing === -dir && action !== 'super';
    const dmg = spec.dmg * mod.dmg * (blocked ? 0.2 : 1) * (0.9 + rand() * 0.2);
    o.hp -= dmg;
    f.damage += dmg;
    f.energy = Math.min(100, f.energy + dmg * 1.6);
    o.energy = Math.min(100, o.energy + dmg * 0.6);
    if (blocked) {
      o.vx = dir * 90;
    } else {
      o.hurtT = 0.28;
      o.action = 'none';
      o.vx = dir * spec.knock;
      o.vy = action === 'super' ? -420 : -160;
      o.onGround = false;
    }
    events.push({ k: 'hit', a: f.id, v: o.id, x: Math.round(o.x), y: Math.round(o.y - 110), blocked, big: action === 'super' });
    if (o.hp <= 0) {
      o.hp = 0;
      o.koT = RESPAWN_SEC;
      o.action = 'none';
      o.falls++;
      f.kos++;
      m.score[f.team] = (m.score[f.team] ?? 0) + 1;
      events.push({ k: 'ko', a: f.id, v: o.id });
    }
  }
}

function decideWinner(m: Match): string {
  const entries = Object.entries(m.score).sort((a, b) => b[1] - a[1]);
  if (entries.length === 0) return 'draw';
  if (entries.length > 1 && entries[0]![1] === entries[1]![1]) return 'draw';
  return entries[0]![0];
}

/** Advance the match one tick. Mutates `m`; returns what happened this tick. */
export function stepMatch(m: Match, inputs: Record<string, Input>, dt = DT, rand: () => number = Math.random): GameEvent[] {
  const events: GameEvent[] = [];
  m.tick++;
  if (m.ended) return events;
  if (m.intro > 0) {
    m.intro = Math.max(0, m.intro - dt);
    return events;
  }
  m.timeLeft = Math.max(0, m.timeLeft - dt);

  for (const f of m.fighters) stepFighter(m, f, inputs[f.id] ?? NO_INPUT, dt, events);
  for (const f of m.fighters) if (hitDue(f)) resolveHit(m, f, events, rand);
  for (const f of m.fighters) finishAction(f);

  const target = winScore(m.mode);
  if (m.timeLeft <= 0 || Object.values(m.score).some((s) => s >= target)) {
    m.ended = true;
    m.winner = decideWinner(m);
  }
  return events;
}

/* ------------------------------------------------------------------ */
/* Bots                                                                */
/* ------------------------------------------------------------------ */
export type BotBrain = { t: number; move: -1 | 0 | 1; blockT: number; jumpT: number };
export const newBrain = (): BotBrain => ({ t: Math.random(), move: 0, blockT: 0, jumpT: 0 });

export function botInput(m: Match, f: Fighter, brain: BotBrain, dt = DT, rand: () => number = Math.random): Input {
  const input: Input = { ...NO_INPUT };
  if (f.koT > 0 || m.intro > 0) return input;
  const foes = m.fighters.filter((o) => o.team !== f.team && o.koT <= 0);
  let target: Fighter | undefined;
  let best = Infinity;
  for (const o of foes) {
    const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y);
    if (d < best) {
      best = d;
      target = o;
    }
  }
  brain.t -= dt;
  brain.blockT = Math.max(0, brain.blockT - dt);
  brain.jumpT = Math.max(0, brain.jumpT - dt);
  if (!target) return input;

  const dx = target.x - f.x;
  const dy = target.y - f.y;
  if (Math.abs(dx) > 55) input.move = dx > 0 ? 1 : -1;
  else if (Math.sign(dx) !== f.facing && Math.abs(dx) > 4) input.move = dx > 0 ? 1 : -1; // turn around

  const attacking = target.action === 'punch' || target.action === 'kick' || target.action === 'super';
  if (brain.t <= 0) {
    brain.t = 0.25 + rand() * 0.45;
    brain.move = rand() < 0.15 ? (dx > 0 ? -1 : 1) : 0;
    if (dy < -60 && f.onGround && rand() < 0.6) brain.jumpT = 0.15;
    if (Math.abs(dx) < 85 && Math.abs(dy) < 50) {
      const r = rand();
      if (f.energy >= 100 && r < 0.4) input.super = true;
      else if (attacking && r < 0.3) brain.blockT = 0.3 + rand() * 0.4;
      else if (r < 0.65) input.punch = true;
      else input.kick = true;
    }
  }
  if (attacking && Math.abs(dx) < 90 && rand() < 0.02) brain.blockT = 0.35;
  if (brain.move) input.move = brain.move;
  input.jump = brain.jumpT > 0;
  input.block = brain.blockT > 0;
  if (input.block) input.move = 0;
  return input;
}

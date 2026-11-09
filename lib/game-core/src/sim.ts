/**
 * Shared fight simulation. The server runs it authoritatively; the client
 * runs the same code for the offline demo and to predict its own fighter.
 * All state is plain data so it can be cloned and sent over the wire.
 */
import type { Accessory, Weapon } from './cosmetics';
import { GROUND, H, LAVA_Y, getMap, inSpan, platformAt, windAt, type MapDef, type MapId } from './maps';

export const TICK_RATE = 30;
export const DT = 1 / TICK_RATE;
export const MATCH_SEC = 180;
export const INTRO_SEC = 1.6;
export const RESPAWN_SEC = 3;

const GRAVITY = 1700;
const SPEED = 260;
const JUMP = 720;
const AIR_JUMP = 640;
const LAVA_DPS = 30;
const LAVA_BOUNCE = 680;
/** a fall or lava K.O. is credited to whoever hit you within this many seconds */
const CREDIT_SEC = 5;

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
  /** index of the platform stood on, -1 for the floor / air */
  plat: number;
  /** jump key was held last tick (jumps trigger on press, not hold) */
  jumpHeld: boolean;
  airJumps: number;
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
  lastHitBy: string;
  lastHitT: number;
  burnT: number;
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

export type KoCause = 'hit' | 'fall' | 'lava';

export type GameEvent =
  | { k: 'hit'; a: string; v: string; x: number; y: number; blocked: boolean; big: boolean }
  /** a = attacker id, or '' for a self-inflicted fall / burn */
  | { k: 'ko'; a: string; v: string; how: KoCause }
  | { k: 'super'; a: string; x: number; y: number }
  | { k: 'burn'; v: string; x: number; y: number };

export type Match = {
  mode: Mode;
  map: MapId;
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

/** Seconds since the match was created; drives moving platforms and wind. */
export const matchTime = (tick: number) => tick * DT;

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
export function spawnPos(mode: Mode, map: MapDef, team: string, spawn: number): { x: number; y: number; facing: 1 | -1 } {
  const list = mode === 'team' ? (team === 'red' ? map.spawns.red : map.spawns.blue) : map.spawns.ffa;
  const x = list[spawn % list.length]!;
  return { x, y: GROUND, facing: x < 500 ? 1 : -1 };
}

export function createMatch(mode: Mode, roster: RosterEntry[], duration = MATCH_SEC, map: MapId = 'notebook'): Match {
  const m: Match = { mode, map, duration, tick: 0, timeLeft: duration, intro: INTRO_SEC, fighters: [], score: {}, ended: false, winner: null };
  for (const r of roster) addFighter(m, r);
  return m;
}

export function addFighter(m: Match, r: RosterEntry): Fighter {
  const team = m.mode === 'team' ? r.team : r.id;
  const used = new Set(m.fighters.filter((f) => m.mode === 'ffa' || f.team === team).map((f) => f.spawn));
  let spawn = 0;
  while (used.has(spawn)) spawn++;
  const p = spawnPos(m.mode, getMap(m.map), team, spawn);
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
    plat: -1,
    jumpHeld: false,
    airJumps: 1,
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
    lastHitBy: '',
    lastHitT: 99,
    burnT: 0,
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
type StepCtx = { mode: Mode; map: MapDef; t: number };

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

function stepFighter(ctx: StepCtx, f: Fighter, input: Input, dt: number, events: GameEvent[] | null) {
  const { map, t } = ctx;
  f.cooldown = Math.max(0, f.cooldown - dt);
  f.hurtT = Math.max(0, f.hurtT - dt);
  f.burnT = Math.max(0, f.burnT - dt);
  f.lastHitT += dt;

  if (f.koT > 0) {
    f.koT -= dt;
    f.vx *= 0.9;
    if (f.koT <= 0) {
      const p = spawnPos(ctx.mode, map, f.team, f.spawn);
      Object.assign(f, {
        koT: 0, hp: 100, x: p.x, y: 0, vx: 0, vy: 0, facing: p.facing, action: 'none', hurtT: 0,
        onGround: false, plat: -1, airJumps: 1, lastHitBy: '', lastHitT: 99,
      });
    }
    // a K.O.'d body that fell into a pit just stays down there
    if (f.y > H + 60) return;
  } else {
    if (input.punch) tryStart(f, 'punch', events);
    if (input.kick) tryStart(f, 'kick', events);
    if (input.super) tryStart(f, 'super', events);

    if (input.block && f.action === 'none' && f.onGround && f.hurtT <= 0) f.action = 'block';
    if (!input.block && f.action === 'block') f.action = 'none';

    const pressedJump = input.jump && !f.jumpHeld;
    const busy = f.hurtT > 0 || (f.action !== 'none' && f.action !== 'block');
    if (!busy) {
      const speed = f.action === 'block' ? SPEED * 0.25 : SPEED;
      f.vx += (input.move * speed - f.vx) * Math.min(1, dt * 14);
      if (input.move) f.facing = input.move;
      if (pressedJump && f.onGround) {
        f.vy = -JUMP;
        f.onGround = false;
        f.plat = -1;
        if (f.action === 'block') f.action = 'none';
      } else if (pressedJump && f.airJumps > 0) {
        // one extra jump in the air — the way back from a pit edge
        f.vy = -AIR_JUMP;
        f.airJumps--;
      }
    } else {
      f.vx *= Math.pow(0.02, dt);
    }
    if (attackSpec(f)) f.actionT += dt;
  }
  f.jumpHeld = input.jump;

  /* ---------------- physics ---------------- */
  // ride a moving platform
  if (f.onGround && f.plat >= 0) {
    const p = map.platforms[f.plat];
    if (p?.move) {
      const a = platformAt(p, t - dt);
      const b = platformAt(p, t);
      f.x += b.x1 - a.x1;
      f.y = b.y;
    }
  }
  // wind gusts (weaker while braced on the ground)
  const wind = windAt(map, t);
  if (wind && f.koT <= 0) f.x += wind * dt * (f.onGround ? (f.action === 'block' ? 0.25 : 0.7) : 1);

  const prevX = f.x;
  const prevY = f.y;
  f.vy += GRAVITY * dt;
  f.x += f.vx * dt;
  f.y += f.vy * dt;
  f.onGround = false;

  // pit walls: once below the floor line you can't walk into the building side
  if (prevY > GROUND + 2 && inSpan(map.ground, f.x)) {
    f.x = prevX;
    f.vx = 0;
  }

  if (f.vy >= 0) {
    // floor
    if (prevY <= GROUND + 1 && f.y >= GROUND && inSpan(map.ground, f.x)) {
      f.y = GROUND;
      f.vy = 0;
      f.onGround = true;
      f.plat = -1;
    }
    // platforms (one-way, land from above)
    for (let i = 0; i < map.platforms.length; i++) {
      const now = platformAt(map.platforms[i]!, t);
      const before = platformAt(map.platforms[i]!, t - dt);
      if (prevY <= Math.max(now.y, before.y) + 1 && f.y >= now.y && f.x >= now.x1 && f.x <= now.x2) {
        f.y = now.y;
        f.vy = 0;
        f.onGround = true;
        f.plat = i;
      }
    }
  }
  // lava: burn and bounce
  if (f.y >= LAVA_Y && inSpan(map.lava, f.x) && f.koT <= 0) {
    f.y = LAVA_Y;
    f.vy = -LAVA_BOUNCE;
    f.hp -= LAVA_DPS * 0.35;
    f.hurtT = 0.2;
    f.airJumps = 1;
    if (f.burnT <= 0) {
      f.burnT = 0.35;
      events?.push({ k: 'burn', v: f.id, x: Math.round(f.x), y: Math.round(f.y - 100) });
    }
  }
  if (f.onGround) f.airJumps = 1;

  if (f.x < map.bounds.x1) {
    f.x = map.bounds.x1;
    f.vx = Math.abs(f.vx) * 0.3;
  }
  if (f.x > map.bounds.x2) {
    f.x = map.bounds.x2;
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
 * action timing as the server, but hits and K.O.s are left to the server.
 * `tick` is the match tick this input applies to.
 */
export function predictStep(mode: Mode, mapId: MapId, tick: number, f: Fighter, input: Input, dt = DT) {
  if (f.koT > 0) return;
  stepFighter({ mode, map: getMap(mapId), t: matchTime(tick) }, f, input, dt, null);
  if (hitDue(f)) f.hitDone = true;
  finishAction(f);
}

/* ------------------------------------------------------------------ */
/* Whole-match step                                                     */
/* ------------------------------------------------------------------ */
function knockOut(m: Match, o: Fighter, how: KoCause, attackerId: string, events: GameEvent[]) {
  o.hp = 0;
  o.koT = RESPAWN_SEC;
  o.action = 'none';
  o.falls++;
  const attacker = attackerId ? m.fighters.find((x) => x.id === attackerId && x.team !== o.team) : undefined;
  if (attacker) {
    attacker.kos++;
    m.score[attacker.team] = (m.score[attacker.team] ?? 0) + 1;
  }
  events.push({ k: 'ko', a: attacker?.id ?? '', v: o.id, how });
}

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
    o.lastHitBy = f.id;
    o.lastHitT = 0;
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
      o.plat = -1;
    }
    events.push({ k: 'hit', a: f.id, v: o.id, x: Math.round(o.x), y: Math.round(o.y - 110), blocked, big: action === 'super' });
    if (o.hp <= 0) knockOut(m, o, 'hit', f.id, events);
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

  const ctx: StepCtx = { mode: m.mode, map: getMap(m.map), t: matchTime(m.tick) };
  for (const f of m.fighters) stepFighter(ctx, f, inputs[f.id] ?? NO_INPUT, dt, events);
  for (const f of m.fighters) if (hitDue(f)) resolveHit(m, f, events, rand);
  for (const f of m.fighters) finishAction(f);

  // environment K.O.s: falling off the map or burning out in lava
  for (const f of m.fighters) {
    if (f.koT > 0) continue;
    const credit = f.lastHitT < CREDIT_SEC ? f.lastHitBy : '';
    if (f.y > H + 60) knockOut(m, f, 'fall', credit, events);
    else if (f.hp <= 0) knockOut(m, f, 'lava', credit, events);
  }

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

/** Is there floor (not pit, not lava) under x at floor level? */
const solidAt = (map: MapDef, x: number) => inSpan(map.ground, x);

export function botInput(m: Match, f: Fighter, brain: BotBrain, dt = DT, rand: () => number = Math.random): Input {
  const input: Input = { ...NO_INPUT };
  if (f.koT > 0 || m.intro > 0) return input;
  const map = getMap(m.map);
  brain.t -= dt;
  brain.blockT = Math.max(0, brain.blockT - dt);
  brain.jumpT = Math.max(0, brain.jumpT - dt);

  // In trouble (over a pit or lava while airborne): steer to safe floor and use the air jump.
  const onFloorLevel = f.y >= GROUND - 2;
  if (!f.onGround && !solidAt(map, f.x) && f.vy > 0) {
    const safe = map.ground.reduce((best, s) => {
      const cx = Math.min(Math.max(f.x, s.x1 + 30), s.x2 - 30);
      return Math.abs(cx - f.x) < Math.abs(best - f.x) ? cx : best;
    }, map.ground[0] ? (map.ground[0].x1 + map.ground[0].x2) / 2 : f.x);
    input.move = safe > f.x ? 1 : -1;
    input.jump = f.airJumps > 0 && !f.jumpHeld;
    return input;
  }

  const foes = m.fighters.filter((o) => o.team !== f.team && o.koT <= 0 && o.y < H);
  let target: Fighter | undefined;
  let best = Infinity;
  for (const o of foes) {
    const d = Math.abs(o.x - f.x) + Math.abs(o.y - f.y);
    if (d < best) {
      best = d;
      target = o;
    }
  }
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

  // Edge awareness: don't walk off into a pit or lava unless the target is across it.
  if (input.move && f.onGround && f.plat < 0 && onFloorLevel) {
    const ahead = f.x + input.move * 45;
    if (!solidAt(map, ahead)) {
      const across = Math.sign(dx) === input.move && Math.abs(dx) > 120;
      if (across && solidAt(map, f.x + input.move * 280)) brain.jumpT = 0.15;
      else input.move = 0;
    }
  }

  input.jump = brain.jumpT > 0;
  input.block = brain.blockT > 0;
  if (input.block) input.move = 0;
  return input;
}

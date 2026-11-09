import { BOTS_POOL, type Player } from './types';
import {
  DT,
  addFighter,
  botInput,
  createMatch,
  heldOnly,
  newBrain,
  removeFighter,
  stepMatch,
  type BotBrain,
  type ChatLine,
  type FighterSnap,
  type GameEvent,
  type Input,
  type MapChoice,
  resolveMapChoice,
  MAPS,
  type Match,
  type MatchResultMsg,
  type Mode,
  type RoomMember,
  type RoomPhase,
  type RoomSummary,
  type RoomView,
  type RosterEntry,
  type ServerMsg,
  NO_INPUT,
  TICK_RATE,
  MATCH_SEC,
} from '@workspace/game-core';
import { logger } from '../lib/logger';

const COUNTDOWN_SEC = 3;
/** Match length; override with GAME_MATCH_SECONDS (e.g. for quick tests). */
const MATCH_SECONDS = Math.min(600, Math.max(10, Number(process.env.GAME_MATCH_SECONDS) || MATCH_SEC));
/** Snapshots go out every N ticks (30 Hz / 2 = 15 Hz). */
const SNAPSHOT_EVERY = 2;
/** Inputs buffered per player beyond this are dropped (oldest first). */
const MAX_INPUT_QUEUE = 6;
const CHAT_HISTORY = 30;

type Bot = { id: string; name: string; color: string; accessory: RoomMember['accessory']; weapon: RoomMember['weapon']; team: 'red' | 'blue'; brain: BotBrain };

export class Room {
  readonly id: string;
  readonly name: string;
  readonly mode: Mode;
  /** what the host picked ('random' resolves when a match starts) */
  map: MapChoice;
  readonly max: number;
  private readonly password: string | undefined;

  hostId: string;
  phase: RoomPhase = 'waiting';
  readonly players = new Map<string, Player>();
  private readonly bots = new Map<string, Bot>();
  /** join order, used for stable slot ordering in the UI */
  private order: string[] = [];
  private chat: ChatLine[] = [];
  private match: Match | null = null;
  private pendingEvents: GameEvent[] = [];
  private loop: NodeJS.Timeout | null = null;
  private countdownTimer: NodeJS.Timeout | null = null;
  private botSeq = 0;

  constructor(
    opts: { id: string; name: string; mode: Mode; map: MapChoice; max: number; password?: string; host: Player },
    private readonly onChange: (room: Room) => void,
  ) {
    this.id = opts.id;
    this.name = opts.name;
    this.mode = opts.mode;
    this.map = opts.map;
    this.max = opts.max;
    this.password = opts.password || undefined;
    this.hostId = opts.host.id;
  }

  get locked() {
    return !!this.password;
  }
  get size() {
    return this.players.size + this.bots.size;
  }
  get isFull() {
    return this.size >= this.max;
  }

  checkPassword(pw: string | undefined) {
    return !this.password || pw === this.password;
  }

  /* ---------------- membership ---------------- */
  private pickTeam(): 'red' | 'blue' {
    let red = 0;
    let blue = 0;
    for (const m of this.members()) m.team === 'red' ? red++ : blue++;
    return red <= blue ? 'red' : 'blue';
  }

  join(p: Player) {
    p.roomId = this.id;
    p.team = this.pickTeam();
    p.ready = false;
    p.inputs = [];
    p.lastInput = NO_INPUT;
    p.ack = 0;
    p.lastSeqSeen = 0;
    this.players.set(p.id, p);
    this.order.push(p.id);
    p.send({ t: 'chatHistory', lines: this.chat });
    this.system(`${p.profile.name} đã vào phòng`);
    if (this.match) {
      addFighter(this.match, this.rosterEntry(p.id)!);
      p.send({ t: 'start', mode: this.mode, map: this.match.map, roster: this.roster() });
      this.broadcast({ t: 'roster', roster: this.roster() });
    }
    this.changed();
  }

  /** @returns true if the room is now empty of humans and should be removed */
  leave(p: Player): boolean {
    if (!this.players.delete(p.id)) return this.players.size === 0;
    this.order = this.order.filter((id) => id !== p.id);
    p.roomId = null;
    if (this.match) {
      removeFighter(this.match, p.id);
      this.broadcast({ t: 'roster', roster: this.roster() });
    }
    if (this.players.size === 0) {
      this.dispose();
      return true;
    }
    if (this.hostId === p.id) {
      this.hostId = this.players.keys().next().value!;
      this.system(`${this.players.get(this.hostId)!.profile.name} giờ là chủ phòng`);
    }
    this.system(`${p.profile.name} đã rời phòng`);
    if (this.phase === 'countdown') this.cancelCountdown('Có người rời phòng, huỷ đếm ngược');
    this.changed();
    return false;
  }

  setTeam(p: Player, team: 'red' | 'blue') {
    if (this.phase !== 'waiting' || this.mode !== 'team' || p.team === team) return;
    const perTeam = Math.ceil(this.max / 2);
    if (this.members().filter((m) => m.team === team).length >= perTeam) return p.error('team_full', 'Đội này đã đủ người');
    p.team = team;
    p.ready = false;
    this.changed();
  }

  setReady(p: Player, ready: boolean) {
    if (this.phase !== 'waiting') return;
    p.ready = ready;
    this.changed();
  }

  addBot(by: Player) {
    if (by.id !== this.hostId) return by.error('not_host', 'Chỉ chủ phòng mới thêm được bot');
    if (this.phase !== 'waiting') return;
    if (this.isFull) return by.error('room_full', 'Phòng đã đầy');
    const used = new Set([...this.bots.values()].map((b) => b.name));
    const pick = BOTS_POOL.find((b) => !used.has(b.name)) ?? BOTS_POOL[this.botSeq % BOTS_POOL.length]!;
    const id = `b${++this.botSeq}`;
    this.bots.set(id, { ...pick, name: used.has(pick.name) ? `${pick.name}${this.botSeq}` : pick.name, id, team: this.pickTeam(), brain: newBrain() });
    this.order.push(id);
    this.changed();
  }

  kick(by: Player, id: string) {
    if (by.id !== this.hostId || this.phase !== 'waiting') return;
    if (this.bots.delete(id)) {
      this.order = this.order.filter((x) => x !== id);
      this.changed();
    }
  }

  setMap(by: Player, map: MapChoice) {
    if (by.id !== this.hostId) return by.error('not_host', 'Chỉ chủ phòng mới đổi được bản đồ');
    if (this.phase !== 'waiting' || this.map === map) return;
    this.map = map;
    this.system(`Bản đồ: ${map === 'random' ? 'Ngẫu nhiên' : MAPS[map].name}`);
    this.changed();
  }

  say(p: Player, text: string) {
    const now = Date.now();
    if (now - p.lastChatAt < 600) return p.error('slow_down', 'Nhắn chậm thôi');
    p.lastChatAt = now;
    this.pushChat({ from: p.profile.name, text, sys: false });
  }

  private system(text: string) {
    this.pushChat({ from: 'Hệ thống', text, sys: true });
  }

  private pushChat(line: ChatLine) {
    this.chat.push(line);
    if (this.chat.length > CHAT_HISTORY) this.chat.shift();
    this.broadcast({ t: 'chat', line });
  }

  /* ---------------- match lifecycle ---------------- */
  start(by: Player) {
    if (by.id !== this.hostId) return by.error('not_host', 'Chỉ chủ phòng mới bắt đầu được');
    if (this.phase !== 'waiting') return;
    if (this.size < 2) return by.error('not_enough', 'Cần ít nhất 2 người (có thể thêm bot)');
    if ([...this.players.values()].some((p) => !p.ready && p.id !== this.hostId))
      return by.error('not_ready', 'Còn người chưa sẵn sàng');
    if (this.mode === 'team') {
      const teams = new Set(this.members().map((m) => m.team));
      if (teams.size < 2) return by.error('one_team', 'Mỗi đội cần ít nhất 1 người');
    }
    this.phase = 'countdown';
    this.changed();
    let n = COUNTDOWN_SEC;
    const tick = () => {
      if (this.phase !== 'countdown') return;
      if (n === 0) return this.beginMatch();
      this.broadcast({ t: 'countdown', n });
      n--;
      this.countdownTimer = setTimeout(tick, 1000);
    };
    tick();
  }

  private cancelCountdown(reason: string) {
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.phase = 'waiting';
    this.system(reason);
  }

  private beginMatch() {
    this.countdownTimer = null;
    this.phase = 'playing';
    const roster = this.roster();
    this.match = createMatch(this.mode, roster, MATCH_SECONDS, resolveMapChoice(this.map));
    for (const p of this.players.values()) {
      p.inputs = [];
      p.lastInput = NO_INPUT;
      p.ack = 0;
      p.lastSeqSeen = 0;
    }
    this.broadcast({ t: 'start', mode: this.mode, map: this.match.map, roster });
    this.loop = setInterval(() => this.tick(), 1000 / TICK_RATE);
    logger.info({ room: this.id, players: this.players.size, bots: this.bots.size, map: this.match.map }, 'match started');
    this.changed();
  }

  private tick() {
    const m = this.match;
    if (!m) return;
    const inputs: Record<string, Input> = {};
    for (const p of this.players.values()) {
      const next = p.inputs.shift();
      if (next) {
        inputs[p.id] = next.input;
        p.lastInput = next.input;
        p.ack = next.seq;
      } else {
        // no fresh input this tick: keep holding the last keys, never repeat attacks
        inputs[p.id] = heldOnly(p.lastInput);
      }
    }
    for (const b of this.bots.values()) {
      const f = m.fighters.find((x) => x.id === b.id);
      if (f) inputs[b.id] = botInput(m, f, b.brain);
    }
    this.pendingEvents.push(...stepMatch(m, inputs));

    if (m.ended) {
      this.sendSnapshots();
      return this.endMatch();
    }
    if (m.tick % SNAPSHOT_EVERY === 0) this.sendSnapshots();
  }

  private sendSnapshots() {
    const m = this.match!;
    const fighters: FighterSnap[] = m.fighters.map((f) => ({
      id: f.id,
      x: r1(f.x),
      y: r1(f.y),
      vx: r1(f.vx),
      vy: r1(f.vy),
      f: f.facing,
      g: f.onGround,
      p: f.plat,
      jh: f.jumpHeld,
      aj: f.airJumps,
      hp: r1(f.hp),
      en: r1(f.energy),
      a: f.action,
      at: r3(f.actionT),
      hd: f.hitDone,
      ht: r3(f.hurtT),
      ko: r3(f.koT),
      cd: r3(f.cooldown),
      k: f.kos,
      d: f.falls,
      dm: Math.round(f.damage),
    }));
    const body = JSON.stringify({
      tick: m.tick,
      timeLeft: r3(m.timeLeft),
      intro: r3(m.intro),
      score: m.score,
      fighters,
      events: this.pendingEvents,
    });
    this.pendingEvents = [];
    // Shared body, per-player ack prepended without re-serializing.
    for (const p of this.players.values()) p.sendRaw(`{"t":"snap","ack":${p.ack},${body.slice(1)}`);
  }

  private endMatch() {
    const m = this.match!;
    const roster = this.roster();
    const result: MatchResultMsg = {
      winner: m.winner ?? 'draw',
      mode: this.mode,
      map: m.map,
      score: m.score,
      durationSec: Math.round(m.duration - m.timeLeft),
      players: m.fighters.map((f) => ({
        ...(roster.find((r) => r.id === f.id) ?? { id: f.id, name: f.name, team: f.team, color: f.color, accessory: f.accessory, weapon: f.weapon, bot: f.bot }),
        team: f.team,
        kos: f.kos,
        falls: f.falls,
        damage: Math.round(f.damage),
      })),
    };
    this.stopLoop();
    this.match = null;
    this.phase = 'waiting';
    for (const p of this.players.values()) p.ready = false;
    this.broadcast({ t: 'end', result });
    logger.info({ room: this.id, winner: result.winner, score: result.score }, 'match ended');
    this.changed();
  }

  input(p: Player, seq: number, input: Input) {
    if (!this.match || seq <= p.lastSeqSeen) return;
    p.lastSeqSeen = seq;
    p.inputs.push({ seq, input });
    if (p.inputs.length > MAX_INPUT_QUEUE) p.inputs.splice(0, p.inputs.length - MAX_INPUT_QUEUE);
  }

  private stopLoop() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
  }

  dispose() {
    this.stopLoop();
    if (this.countdownTimer) clearTimeout(this.countdownTimer);
    this.countdownTimer = null;
    this.match = null;
  }

  /* ---------------- views ---------------- */
  private members(): RoomMember[] {
    const out: RoomMember[] = [];
    for (const id of this.order) {
      const p = this.players.get(id);
      if (p) {
        out.push({ id, ...p.profile, team: p.team, ready: p.ready || id === this.hostId, bot: false });
        continue;
      }
      const b = this.bots.get(id);
      if (b) out.push({ id, name: b.name, color: b.color, accessory: b.accessory, weapon: b.weapon, team: b.team, ready: true, bot: true });
    }
    return out;
  }

  private rosterEntry(id: string): RosterEntry | undefined {
    const m = this.members().find((x) => x.id === id);
    return m && { id: m.id, name: m.name, team: m.team, color: m.color, accessory: m.accessory, weapon: m.weapon, bot: m.bot };
  }

  private roster(): RosterEntry[] {
    const inMatch = this.match ? new Set(this.match.fighters.map((f) => f.id)) : null;
    return this.members()
      .filter((m) => !inMatch || inMatch.has(m.id))
      .map((m) => ({ id: m.id, name: m.name, team: m.team, color: m.color, accessory: m.accessory, weapon: m.weapon, bot: m.bot }));
  }

  view(): RoomView {
    return {
      id: this.id,
      name: this.name,
      mode: this.mode,
      map: this.map,
      max: this.max,
      locked: this.locked,
      hostId: this.hostId,
      phase: this.phase,
      members: this.members(),
    };
  }

  summary(): RoomSummary {
    return {
      id: this.id,
      name: this.name,
      host: this.players.get(this.hostId)?.profile.name ?? '?',
      mode: this.mode,
      map: this.map,
      players: this.size,
      max: this.max,
      phase: this.phase,
      locked: this.locked,
    };
  }

  private changed() {
    this.broadcast({ t: 'room', room: this.view() });
    this.onChange(this);
  }

  broadcast(msg: ServerMsg) {
    const raw = JSON.stringify(msg);
    for (const p of this.players.values()) p.sendRaw(raw);
  }
}

const r1 = (n: number) => Math.round(n * 10) / 10;
const r3 = (n: number) => Math.round(n * 1000) / 1000;

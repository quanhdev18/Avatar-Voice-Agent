/**
 * WebSocket client for the Que Chiến game server.
 *
 * - Lobby/room state lives in an immutable `NetState` exposed through `useNet`.
 * - Match data (15 Hz snapshots) bypasses React: it goes into a mutable
 *   `NetMatch`, which the Play page reads every animation frame.
 */
import { useSyncExternalStore } from 'react';
import {
  COLOR_VALUES,
  DT,
  GAME_WS_PATH,
  PROTOCOL_VERSION,
  packInput,
  predictStep,
  type ChatLine,
  type ClientMsg,
  type Fighter,
  type FighterSnap,
  type GameEvent,
  type Input,
  type Mode,
  type Profile,
  type RoomSummary,
  type RoomView,
  type RosterEntry,
  type ServerMsg,
  type Snapshot,
} from '@workspace/game-core';

import type { MatchResult } from '@/lib/store';

export type NetStatus = 'idle' | 'connecting' | 'open' | 'closed';

export type NetState = {
  status: NetStatus;
  myId: string | null;
  rooms: RoomSummary[];
  room: RoomView | null;
  chat: ChatLine[];
  countdown: number | null;
  match: NetMatch | null;
  result: MatchResult | null;
  error: { code: string; message: string; at: number } | null;
  ping: number | null;
};

const INITIAL: NetState = {
  status: 'idle',
  myId: null,
  rooms: [],
  room: null,
  chat: [],
  countdown: null,
  match: null,
  result: null,
  error: null,
  ping: null,
};

function serverUrl() {
  const override = import.meta.env.VITE_GAME_SERVER_URL as string | undefined;
  if (override) return override;
  const proto = location.protocol === 'https:' ? 'wss' : 'ws';
  return `${proto}://${location.host}${GAME_WS_PATH}`;
}

/** Make sure the profile passes server validation. */
function safeProfile(p: Profile): Profile {
  const name = p.name.replace(/\s+/g, ' ').trim().slice(0, 16) || 'NguoiQue';
  const color = (COLOR_VALUES as readonly string[]).includes(p.color) ? p.color : COLOR_VALUES[0];
  return { ...p, name, color };
}

class GameClient {
  private state: NetState = INITIAL;
  private listeners = new Set<() => void>();
  private ws: WebSocket | null = null;
  private profile: Profile | null = null;
  private retries = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private gaveUp = false;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };
  getState = () => this.state;

  private set(patch: Partial<NetState>) {
    this.state = { ...this.state, ...patch };
    for (const fn of this.listeners) fn();
  }

  connect(profile: Profile) {
    this.profile = safeProfile(profile);
    this.gaveUp = false;
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) return;
    this.open();
  }

  /** Manual reconnect from the UI. */
  retry() {
    this.retries = 0;
    if (this.profile) this.connect(this.profile);
  }

  updateProfile(profile: Profile) {
    this.profile = safeProfile(profile);
    this.send({ t: 'profile', profile: this.profile });
  }

  send(msg: ClientMsg): boolean {
    if (this.ws?.readyState !== WebSocket.OPEN) return false;
    this.ws.send(JSON.stringify(msg));
    return true;
  }

  private open() {
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.set({ status: 'connecting' });
    let ws: WebSocket;
    try {
      ws = new WebSocket(serverUrl());
    } catch {
      this.set({ status: 'closed' });
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this.retries = 0;
      if (!this.profile) return ws.close();
      ws.send(JSON.stringify({ t: 'hello', v: PROTOCOL_VERSION, profile: this.profile } satisfies ClientMsg));
      this.pingTimer = setInterval(() => this.send({ t: 'ping', ts: performance.now() }), 5000);
    };
    ws.onmessage = (e) => {
      try {
        this.onMessage(JSON.parse(e.data as string) as ServerMsg);
      } catch (err) {
        console.error('bad server message', err);
      }
    };
    ws.onclose = (e) => {
      if (this.pingTimer) clearInterval(this.pingTimer);
      this.ws = null;
      // the server forgets our room when the socket drops
      this.set({ status: 'closed', myId: null, room: null, chat: [], countdown: null, match: null });
      if (e.code === 4001 || e.code === 4002) {
        this.gaveUp = true;
        this.set({ error: { code: 'rejected', message: 'Máy chủ từ chối kết nối (sai phiên bản hoặc hồ sơ)', at: Date.now() } });
        return;
      }
      if (this.gaveUp) return;
      const delay = Math.min(10_000, 1000 * 2 ** this.retries++);
      this.retryTimer = setTimeout(() => this.open(), delay);
    };
  }

  private onMessage(msg: ServerMsg) {
    switch (msg.t) {
      case 'welcome':
        this.set({ status: 'open', myId: msg.id });
        return;
      case 'rooms':
        this.set({ rooms: msg.rooms });
        return;
      case 'room':
        this.set({
          room: msg.room,
          ...(msg.room ? {} : { chat: [], match: null }),
          ...(msg.room?.phase === 'waiting' ? { countdown: null } : {}),
        });
        return;
      case 'chatHistory':
        this.set({ chat: msg.lines });
        return;
      case 'chat':
        this.set({ chat: [...this.state.chat, msg.line].slice(-60) });
        return;
      case 'countdown':
        this.set({ countdown: msg.n });
        return;
      case 'start':
        this.set({ countdown: null, result: null, match: new NetMatch(msg.mode, msg.roster, this.state.myId ?? '', (m) => this.send(m)) });
        return;
      case 'roster':
        this.state.match?.setRoster(msg.roster);
        return;
      case 'snap':
        this.state.match?.onSnapshot(msg);
        return;
      case 'end': {
        const r = msg.result;
        const myId = this.state.myId;
        const result: MatchResult = {
          mode: r.mode,
          winner: r.winner,
          score: r.score,
          durationSec: r.durationSec,
          roomId: this.state.room?.id,
          players: r.players.map((p) => ({ ...p, you: p.id === myId })),
        };
        this.state.match?.end();
        // match: null so the room page doesn't bounce back into the arena
        this.set({ result, match: null });
        return;
      }
      case 'error':
        this.set({ error: { code: msg.code, message: msg.message, at: Date.now() } });
        return;
      case 'pong':
        this.set({ ping: Math.round(performance.now() - msg.ts) });
        return;
    }
  }
}

export const net = new GameClient();

export function useNet<T>(select: (s: NetState) => T): T {
  return useSyncExternalStore(net.subscribe, () => select(net.getState()));
}

/* ------------------------------------------------------------------ */
/* Online match: interpolation for others, prediction for yourself     */
/* ------------------------------------------------------------------ */
const INTERP_DELAY = 0.1; // seconds behind the newest snapshot
const MAX_SNAPS = 30;

export type InputState = {
  left: boolean;
  right: boolean;
  jump: boolean;
  block: boolean;
  punch: boolean;
  kick: boolean;
  super: boolean;
};

/** Read held keys and consume one-shot attack presses. */
export function takeInput(s: InputState): Input {
  const i: Input = {
    move: s.left === s.right ? 0 : s.left ? -1 : 1,
    jump: s.jump,
    block: s.block,
    punch: s.punch,
    kick: s.kick,
    super: s.super,
  };
  s.punch = s.kick = s.super = false;
  return i;
}

export type MatchView = {
  mode: Mode;
  meId: string;
  fighters: Fighter[];
  score: Record<string, number>;
  timeLeft: number;
  intro: number;
};

export class NetMatch {
  private roster = new Map<string, RosterEntry>();
  private snaps: Snapshot[] = [];
  private renderTime: number | null = null;
  private pred: Fighter | null = null;
  private pending: { seq: number; input: Input }[] = [];
  private seq = 0;
  private acc = 0;
  private smooth = { x: 0, y: 0 };
  private events: GameEvent[] = [];
  ended = false;

  constructor(
    readonly mode: Mode,
    roster: RosterEntry[],
    readonly meId: string,
    private readonly send: (m: ClientMsg) => void,
  ) {
    this.setRoster(roster);
  }

  setRoster(roster: RosterEntry[]) {
    this.roster = new Map(roster.map((r) => [r.id, r]));
  }

  end() {
    this.ended = true;
  }

  get hasData() {
    return this.snaps.length > 0;
  }

  private toFighter(s: FighterSnap): Fighter | null {
    const r = this.roster.get(s.id);
    if (!r) return null;
    return {
      ...r,
      team: this.mode === 'team' ? r.team : r.id,
      spawn: 0,
      x: s.x,
      y: s.y,
      vx: s.vx,
      vy: s.vy,
      facing: s.f,
      onGround: s.g,
      hp: s.hp,
      energy: s.en,
      action: s.a,
      actionT: s.at,
      hitDone: s.hd,
      hurtT: s.ht,
      koT: s.ko,
      cooldown: s.cd,
      kos: s.k,
      falls: s.d,
      damage: s.dm,
    };
  }

  onSnapshot(s: Snapshot) {
    const last = this.snaps[this.snaps.length - 1];
    if (last && s.tick <= last.tick) return;
    this.snaps.push(s);
    if (this.snaps.length > MAX_SNAPS) this.snaps.shift();
    this.events.push(...s.events);
    if (this.renderTime === null) this.renderTime = s.tick * DT - INTERP_DELAY;

    // Reconcile: take the server's state for me, then replay inputs it hasn't seen yet.
    const meSnap = s.fighters.find((f) => f.id === this.meId);
    const server = meSnap ? this.toFighter(meSnap) : null;
    if (!server) {
      this.pred = null;
      return;
    }
    const before = this.pred ? { x: this.pred.x, y: this.pred.y } : null;
    this.pending = this.pending.filter((p) => p.seq > s.ack);
    if (s.intro <= 0) for (const p of this.pending) predictStep(this.mode, server, p.input);
    this.pred = server;
    if (before) {
      this.smooth.x += before.x - server.x;
      this.smooth.y += before.y - server.y;
      if (Math.hypot(this.smooth.x, this.smooth.y) > 120) this.smooth = { x: 0, y: 0 }; // teleport (respawn, big knockback)
    }
  }

  /** Called every animation frame. Returns game events to display. */
  frame(dt: number, input: InputState): GameEvent[] {
    const latest = this.snaps[this.snaps.length - 1];
    if (latest && this.renderTime !== null) {
      this.renderTime += dt;
      const target = latest.tick * DT - INTERP_DELAY;
      const drift = target - this.renderTime;
      this.renderTime = Math.abs(drift) > 0.3 ? target : this.renderTime + drift * 0.08;
    }

    if (!this.ended) {
      this.acc = Math.min(this.acc + dt, DT * 5);
      while (this.acc >= DT) {
        this.acc -= DT;
        const i = takeInput(input);
        this.seq++;
        this.send({ t: 'in', s: this.seq, b: packInput(i) });
        this.pending.push({ seq: this.seq, input: i });
        if (this.pending.length > 90) this.pending.shift();
        if (this.pred && latest && latest.intro <= 0) predictStep(this.mode, this.pred, i);
      }
    }
    const k = Math.exp(-dt * 12);
    this.smooth.x *= k;
    this.smooth.y *= k;

    const out = this.events;
    this.events = [];
    return out;
  }

  view(): MatchView | null {
    const latest = this.snaps[this.snaps.length - 1];
    if (!latest || this.renderTime === null) return null;

    // find the two snapshots around renderTime
    let a = latest;
    let b = latest;
    for (let i = this.snaps.length - 1; i > 0; i--) {
      if (this.snaps[i - 1]!.tick * DT <= this.renderTime) {
        a = this.snaps[i - 1]!;
        b = this.snaps[i]!;
        break;
      }
    }
    const ta = a.tick * DT;
    const tb = b.tick * DT;
    const alpha = tb > ta ? Math.min(1, Math.max(0, (this.renderTime - ta) / (tb - ta))) : 1;

    const fighters: Fighter[] = [];
    for (const fb of b.fighters) {
      if (fb.id === this.meId && this.pred) {
        fighters.push({ ...this.pred, x: this.pred.x + this.smooth.x, y: this.pred.y + this.smooth.y });
        continue;
      }
      const f = this.toFighter(fb);
      if (!f) continue;
      const fa = a.fighters.find((x) => x.id === fb.id);
      if (fa && Math.hypot(fb.x - fa.x, fb.y - fa.y) < 150) {
        f.x = fa.x + (fb.x - fa.x) * alpha;
        f.y = fa.y + (fb.y - fa.y) * alpha;
      }
      fighters.push(f);
    }
    return { mode: this.mode, meId: this.meId, fighters, score: latest.score, timeLeft: latest.timeLeft, intro: latest.intro };
  }
}

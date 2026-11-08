import type { WebSocket } from 'ws';
import { NO_INPUT, type Accessory, type Input, type Profile, type ServerMsg, type Weapon } from '@workspace/game-core';

/** A connected human player. */
export class Player {
  roomId: string | null = null;
  team: 'red' | 'blue' = 'red';
  ready = false;
  inputs: { seq: number; input: Input }[] = [];
  lastInput: Input = NO_INPUT;
  /** last input sequence applied by the simulation */
  ack = 0;
  /** highest sequence received (rejects replays / reordering) */
  lastSeqSeen = 0;
  lastChatAt = 0;
  alive = true;
  /** token bucket for message rate limiting */
  tokens = 60;
  lastRefill = Date.now();

  constructor(
    readonly id: string,
    readonly ws: WebSocket,
    public profile: Profile,
  ) {}

  sendRaw(raw: string) {
    if (this.ws.readyState === this.ws.OPEN) this.ws.send(raw);
  }

  send(msg: ServerMsg) {
    this.sendRaw(JSON.stringify(msg));
  }

  error(code: string, message: string) {
    this.send({ t: 'error', code, message });
  }

  /** @returns false when the client is sending faster than allowed */
  take(): boolean {
    const now = Date.now();
    this.tokens = Math.min(60, this.tokens + ((now - this.lastRefill) / 1000) * 45);
    this.lastRefill = now;
    if (this.tokens < 1) return false;
    this.tokens -= 1;
    return true;
  }
}

export const BOTS_POOL: { name: string; color: string; accessory: Accessory; weapon: Weapon }[] = [
  { name: 'Bot TrumQue', color: 'var(--crimson)', accessory: 'crown', weapon: 'sword' },
  { name: 'Bot MeoMeo', color: '#e858a8', accessory: 'halo', weapon: 'none' },
  { name: 'Bot KhoaBu', color: 'var(--cobalt)', accessory: 'cap', weapon: 'staff' },
  { name: 'Bot SieuNhan', color: 'var(--violet)', accessory: 'horns', weapon: 'hammer' },
  { name: 'Bot ThayDo', color: 'var(--mint)', accessory: 'ninja', weapon: 'none' },
  { name: 'Bot GaCon', color: '#f2802e', accessory: 'none', weapon: 'sword' },
  { name: 'Bot QueHN', color: '#14a3a8', accessory: 'headband', weapon: 'staff' },
];

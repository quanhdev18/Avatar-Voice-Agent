/**
 * WebSocket protocol between the Que Chiến client and the game server.
 * Messages are JSON objects with a `t` (type) field.
 * Client → server messages are validated with zod on the server.
 */
import { z } from 'zod/v4';

import { ACCESSORIES, COLOR_VALUES, WEAPONS, type Accessory, type Weapon } from './cosmetics';
import { MAP_IDS, type MapChoice, type MapId } from './maps';
import type { GameEvent, Mode, RosterEntry } from './sim';

export const GAME_WS_PATH = '/api/game/ws';
export const PROTOCOL_VERSION = 1;
export const MAX_MESSAGE_BYTES = 2048;

export const MapChoiceSchema = z.enum([...MAP_IDS, 'random']);

/** Control, zero-width and bidi-override characters. */
const CONTROL_CHARS = /[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g;

/** Strip control characters and collapse whitespace. */
const cleanText = (max: number) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, '').replace(/\s+/g, ' ').trim())
    .pipe(z.string().min(1).max(max));

export const PlayerNameSchema = cleanText(16);

export const ProfileSchema = z.object({
  name: PlayerNameSchema,
  color: z.enum(COLOR_VALUES),
  accessory: z.enum(ACCESSORIES),
  weapon: z.enum(WEAPONS),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const ClientMsgSchema = z.discriminatedUnion('t', [
  z.object({ t: z.literal('hello'), v: z.number().int(), profile: ProfileSchema }),
  z.object({ t: z.literal('profile'), profile: ProfileSchema }),
  z.object({
    t: z.literal('create'),
    name: cleanText(32),
    mode: z.enum(['team', 'ffa']),
    map: MapChoiceSchema,
    max: z.union([z.literal(2), z.literal(4), z.literal(6), z.literal(8)]),
    password: z.string().max(32).optional(),
  }),
  z.object({ t: z.literal('join'), roomId: z.string().regex(/^[A-Z0-9]{4}$/), password: z.string().max(32).optional() }),
  z.object({ t: z.literal('quick') }),
  z.object({ t: z.literal('leave') }),
  z.object({ t: z.literal('team'), team: z.enum(['red', 'blue']) }),
  z.object({ t: z.literal('ready'), ready: z.boolean() }),
  z.object({ t: z.literal('chat'), text: cleanText(120) }),
  z.object({ t: z.literal('addBot') }),
  /** host changes the arena between matches */
  z.object({ t: z.literal('map'), map: MapChoiceSchema }),
  z.object({ t: z.literal('kick'), id: z.string().max(16) }),
  z.object({ t: z.literal('start') }),
  /** s = input sequence number, b = packed input bits */
  z.object({ t: z.literal('in'), s: z.number().int().nonnegative(), b: z.number().int().min(0).max(127) }),
  z.object({ t: z.literal('ping'), ts: z.number() }),
]);
export type ClientMsg = z.input<typeof ClientMsgSchema>;

/* ------------------------------------------------------------------ */
/* Server → client                                                     */
/* ------------------------------------------------------------------ */
export type RoomPhase = 'waiting' | 'countdown' | 'playing';

export type RoomSummary = {
  id: string;
  name: string;
  host: string;
  mode: Mode;
  map: MapChoice;
  players: number;
  max: number;
  phase: RoomPhase;
  locked: boolean;
};

export type RoomMember = {
  id: string;
  name: string;
  color: string;
  accessory: Accessory;
  weapon: Weapon;
  team: 'red' | 'blue';
  ready: boolean;
  bot: boolean;
};

export type RoomView = {
  id: string;
  name: string;
  mode: Mode;
  map: MapChoice;
  max: number;
  locked: boolean;
  hostId: string;
  phase: RoomPhase;
  members: RoomMember[];
};

export type ChatLine = { from: string; text: string; sys: boolean };

/** Fighter state as sent in snapshots (rounded to keep messages small). */
export type FighterSnap = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  f: 1 | -1;
  g: boolean;
  /** platform index stood on (-1 floor/air) */
  p: number;
  /** jump held / air jumps left */
  jh: boolean;
  aj: number;
  hp: number;
  en: number;
  a: 'none' | 'punch' | 'kick' | 'block' | 'super';
  at: number;
  hd: boolean;
  ht: number;
  ko: number;
  cd: number;
  k: number;
  d: number;
  dm: number;
};

export type Snapshot = {
  t: 'snap';
  /** last input sequence the server applied for the receiving client */
  ack: number;
  tick: number;
  timeLeft: number;
  intro: number;
  score: Record<string, number>;
  fighters: FighterSnap[];
  events: GameEvent[];
};

export type MatchResultMsg = {
  winner: string;
  mode: Mode;
  map: MapId;
  score: Record<string, number>;
  durationSec: number;
  players: (RosterEntry & { kos: number; falls: number; damage: number })[];
};

export type ServerMsg =
  | { t: 'welcome'; id: string; v: number }
  | { t: 'rooms'; rooms: RoomSummary[] }
  | { t: 'room'; room: RoomView | null }
  | { t: 'chat'; line: ChatLine }
  | { t: 'chatHistory'; lines: ChatLine[] }
  | { t: 'countdown'; n: number }
  | { t: 'start'; mode: Mode; map: MapId; roster: RosterEntry[] }
  | { t: 'roster'; roster: RosterEntry[] }
  | Snapshot
  | { t: 'end'; result: MatchResultMsg }
  | { t: 'error'; code: string; message: string }
  | { t: 'pong'; ts: number };

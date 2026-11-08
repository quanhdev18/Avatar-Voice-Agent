import type { IncomingMessage, Server } from 'node:http';
import { randomInt } from 'node:crypto';
import { WebSocketServer, type WebSocket } from 'ws';
import {
  ClientMsgSchema,
  GAME_WS_PATH,
  MAX_MESSAGE_BYTES,
  PROTOCOL_VERSION,
  unpackInput,
  type ClientMsg,
  type RoomSummary,
} from '@workspace/game-core';

import { logger } from '../lib/logger';
import { Room } from './room';
import { Player } from './types';

const MAX_ROOMS = 200;
const MAX_CONNECTIONS = 2000;
const HEARTBEAT_MS = 15_000;
const HELLO_TIMEOUT_MS = 10_000;
const ROOM_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Authoritative multiplayer server for Que Chiến.
 * One WebSocket per player; rooms run their own 30 Hz simulation loop.
 */
export class GameServer {
  private readonly wss: WebSocketServer;
  private readonly players = new Map<WebSocket, Player>();
  private readonly rooms = new Map<string, Room>();
  private nextPlayerId = 1;
  private lobbyDirty = false;
  private readonly heartbeat: NodeJS.Timeout;
  private readonly lobbyTimer: NodeJS.Timeout;

  constructor(server: Server) {
    this.wss = new WebSocketServer({ noServer: true, maxPayload: MAX_MESSAGE_BYTES });

    server.on('upgrade', (req, socket, head) => {
      const path = (req.url ?? '').split('?')[0];
      if (path !== GAME_WS_PATH) return; // leave other upgrade handlers alone
      if (this.wss.clients.size >= MAX_CONNECTIONS) {
        socket.write('HTTP/1.1 503 Service Unavailable\r\n\r\n');
        socket.destroy();
        return;
      }
      this.wss.handleUpgrade(req, socket, head, (ws) => this.onConnection(ws, req));
    });

    this.heartbeat = setInterval(() => {
      for (const ws of this.wss.clients) {
        const alive = (ws as WebSocket & { isAlive?: boolean }).isAlive;
        if (alive === false) {
          ws.terminate();
          continue;
        }
        (ws as WebSocket & { isAlive?: boolean }).isAlive = false;
        ws.ping();
      }
    }, HEARTBEAT_MS);

    // Lobby list updates are batched so busy rooms don't spam everyone.
    this.lobbyTimer = setInterval(() => {
      if (!this.lobbyDirty) return;
      this.lobbyDirty = false;
      const raw = JSON.stringify({ t: 'rooms', rooms: this.roomList() });
      for (const p of this.players.values()) if (!p.roomId) p.sendRaw(raw);
    }, 300);

    logger.info({ path: GAME_WS_PATH }, 'game server ready');
  }

  close() {
    clearInterval(this.heartbeat);
    clearInterval(this.lobbyTimer);
    for (const r of this.rooms.values()) r.dispose();
    this.wss.close();
  }

  private onConnection(ws: WebSocket, req: IncomingMessage) {
    const conn = ws as WebSocket & { isAlive?: boolean };
    conn.isAlive = true;
    ws.on('pong', () => (conn.isAlive = true));

    let player: Player | null = null;
    const helloTimer = setTimeout(() => !player && ws.close(4000, 'hello timeout'), HELLO_TIMEOUT_MS);

    ws.on('message', (data, isBinary) => {
      if (isBinary) return ws.close(1003, 'text only');
      let parsed: ClientMsg;
      try {
        const res = ClientMsgSchema.safeParse(JSON.parse(data.toString()));
        if (!res.success) {
          if (!player) return ws.close(4002, 'invalid hello');
          player.error('bad_message', 'Tin nhắn không hợp lệ');
          return;
        }
        parsed = res.data;
      } catch {
        return;
      }

      if (!player) {
        if (parsed.t !== 'hello') return;
        if (parsed.v !== PROTOCOL_VERSION) return ws.close(4001, 'protocol version mismatch');
        clearTimeout(helloTimer);
        player = new Player(`p${this.nextPlayerId++}`, ws, parsed.profile);
        this.players.set(ws, player);
        player.send({ t: 'welcome', id: player.id, v: PROTOCOL_VERSION });
        player.send({ t: 'rooms', rooms: this.roomList() });
        logger.info({ player: player.id, ip: req.socket.remoteAddress }, 'player connected');
        return;
      }

      if (!player.take()) return; // rate limited: drop silently
      this.handle(player, parsed);
    });

    ws.on('close', () => {
      clearTimeout(helloTimer);
      if (!player) return;
      this.leaveRoom(player);
      this.players.delete(ws);
      logger.info({ player: player.id }, 'player disconnected');
    });

    ws.on('error', (err) => logger.warn({ err }, 'websocket error'));
  }

  private handle(p: Player, msg: ClientMsg): void {
    const room = p.roomId ? this.rooms.get(p.roomId) : undefined;
    switch (msg.t) {
      case 'hello':
        return;
      case 'profile':
        // cosmetics are locked once a match is running
        if (room && room.phase !== 'waiting') return;
        p.profile = msg.profile;
        if (room) room.broadcast({ t: 'room', room: room.view() });
        return;
      case 'ping':
        return p.send({ t: 'pong', ts: msg.ts });
      case 'create': {
        if (this.rooms.size >= MAX_ROOMS) return p.error('server_full', 'Máy chủ đã hết phòng trống, thử lại sau');
        this.leaveRoom(p);
        const r = new Room(
          { id: this.newRoomId(), name: msg.name, mode: msg.mode, map: msg.map, max: msg.max, password: msg.password, host: p },
          () => (this.lobbyDirty = true),
        );
        this.rooms.set(r.id, r);
        r.join(p);
        logger.info({ room: r.id, mode: r.mode, host: p.id }, 'room created');
        return;
      }
      case 'join': {
        if (room?.id === msg.roomId) return p.send({ t: 'room', room: room.view() });
        const target = this.rooms.get(msg.roomId);
        if (!target) return p.error('no_room', 'Phòng không tồn tại hoặc đã đóng');
        if (target.isFull) return p.error('room_full', 'Phòng đã đầy');
        if (!target.checkPassword(msg.password)) return p.error('bad_password', 'Sai mật khẩu');
        this.leaveRoom(p);
        target.join(p);
        return;
      }
      case 'quick': {
        const open = [...this.rooms.values()]
          .filter((r) => !r.locked && !r.isFull && r.id !== room?.id)
          .sort((a, b) => Number(a.phase !== 'waiting') - Number(b.phase !== 'waiting') || b.size - a.size)[0];
        if (open) {
          this.leaveRoom(p);
          return open.join(p);
        }
        return this.handle(p, { t: 'create', name: `Phòng của ${p.profile.name}`, mode: 'team', map: 'notebook', max: 8 });
      }
      case 'leave':
        this.leaveRoom(p);
        p.send({ t: 'room', room: null });
        p.send({ t: 'rooms', rooms: this.roomList() });
        return;
      case 'team':
        return room?.setTeam(p, msg.team);
      case 'ready':
        return room?.setReady(p, msg.ready);
      case 'chat':
        return room?.say(p, msg.text);
      case 'addBot':
        return room?.addBot(p);
      case 'kick':
        return room?.kick(p, msg.id);
      case 'start':
        return room?.start(p);
      case 'in':
        return room?.input(p, msg.s, unpackInput(msg.b));
    }
  }

  private leaveRoom(p: Player) {
    if (!p.roomId) return;
    const r = this.rooms.get(p.roomId);
    p.roomId = null;
    if (!r) return;
    if (r.leave(p)) {
      this.rooms.delete(r.id);
      logger.info({ room: r.id }, 'room closed');
    }
    this.lobbyDirty = true;
  }

  private roomList(): RoomSummary[] {
    return [...this.rooms.values()].map((r) => r.summary());
  }

  private newRoomId(): string {
    for (;;) {
      let id = '';
      for (let i = 0; i < 4; i++) id += ROOM_ID_ALPHABET[randomInt(ROOM_ID_ALPHABET.length)];
      if (!this.rooms.has(id)) return id;
    }
  }
}

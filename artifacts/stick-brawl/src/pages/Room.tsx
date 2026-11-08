import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Bot, Copy, Crown, Send, X } from 'lucide-react';
import type { RoomMember, RoomView } from '@workspace/game-core';

import { Page } from '@/components/Layout';
import { StickFigure } from '@/components/StickFigure';
import { Badge, Burst, Button, Panel } from '@/components/ui';
import { MAPS, MODE_LABEL } from '@/lib/mock';
import { cn } from '@/lib/utils';
import { net, useNet } from '@/net/client';

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const status = useNet((s) => s.status);
  const room = useNet((s) => s.room);
  const myId = useNet((s) => s.myId);
  const chat = useNet((s) => s.chat);
  const countdown = useNet((s) => s.countdown);
  const match = useNet((s) => s.match);
  const error = useNet((s) => s.error);
  const [msg, setMsg] = useState('');
  const [joinFailed, setJoinFailed] = useState<string | null>(null);
  const joinSent = useRef(false);
  const chatBox = useRef<HTMLDivElement>(null);

  // Opened by URL (shared link, reload): ask the server to put us in this room.
  useEffect(() => {
    if (status !== 'open') {
      joinSent.current = false;
      return;
    }
    if (room?.id === id || joinSent.current) return;
    joinSent.current = true;
    net.send({ t: 'join', roomId: id });
  }, [status, room, id]);

  useEffect(() => {
    if (error && joinSent.current && room?.id !== id && ['no_room', 'room_full', 'bad_password'].includes(error.code)) setJoinFailed(error.message);
  }, [error, room, id]);

  // Match started → go to the arena.
  useEffect(() => {
    if (match && room?.id === id) nav(`/room/${id}/play`);
  }, [match, room, id, nav]);

  useEffect(() => {
    const el = chatBox.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [chat]);

  const leave = () => {
    net.send({ t: 'leave' });
    nav('/lobby');
  };

  if (joinFailed) {
    return (
      <Page className="flex flex-col items-center text-center">
        <div className="h-48 w-48">
          <StickFigure pose="hurt" />
        </div>
        <h1 className="font-display text-3xl">Không vào được phòng #{id}</h1>
        <p className="mt-2 text-lg text-ink-soft">{joinFailed}</p>
        <Button variant="blue" className="mt-6" onClick={() => nav('/lobby')}>
          Về sảnh
        </Button>
      </Page>
    );
  }

  if (!room || room.id !== id) {
    return (
      <Page className="flex flex-col items-center text-center">
        <div className="h-48 w-48">
          <StickFigure pose="run" />
        </div>
        <h1 className="font-display text-2xl">{status === 'open' ? `Đang vào phòng #${id}…` : 'Đang kết nối máy chủ…'}</h1>
        <Button className="mt-6" onClick={() => nav('/lobby')}>
          Về sảnh
        </Button>
      </Page>
    );
  }

  const isHost = room.hostId === myId;
  const me = room.members.find((m) => m.id === myId);
  const humans = room.members.filter((m) => !m.bot);
  const readyCount = room.members.filter((m) => m.ready).length;
  const othersReady = humans.every((m) => m.ready || m.id === room.hostId);
  const teamsOk = room.mode !== 'team' || new Set(room.members.map((m) => m.team)).size === 2;
  const canStart = isHost && room.phase === 'waiting' && room.members.length >= 2 && othersReady && teamsOk;
  const mapInfo = MAPS.find((m) => m.id === room.map) ?? MAPS[0]!;

  const send = () => {
    if (!msg.trim()) return;
    net.send({ t: 'chat', text: msg.trim() });
    setMsg('');
  };

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={leave} aria-label="Rời phòng">
            <ArrowLeft size={16} strokeWidth={3} />
          </Button>
          <div>
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">{room.name}</h1>
            <div className="flex flex-wrap items-center gap-2 text-ink-soft">
              <span>Mã phòng</span>
              <button
                className="sk inline-flex items-center gap-1 bg-paper-3 px-2 font-display text-sm text-ink"
                onClick={() => navigator.clipboard?.writeText(`${location.origin}${location.pathname}`).catch(() => {})}
                aria-label="Sao chép link phòng"
                title="Sao chép link mời"
              >
                #{room.id} <Copy size={13} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone={room.mode === 'team' ? 'blue' : 'red'}>
            {MODE_LABEL[room.mode]} · tối đa {room.max}
          </Badge>
          <Badge>Bản đồ: {mapInfo.name}</Badge>
          <Badge>3 phút · {room.mode === 'team' ? '10' : '5'} K.O</Badge>
          {room.phase === 'playing' && <Badge tone="red">Đang đấu</Badge>}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        {room.mode === 'team' ? (
          <div className="relative grid gap-6 sm:grid-cols-2">
            <TeamColumn room={room} team="red" myId={myId} isHost={isHost} />
            <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
              <Burst text="VS" size={90} />
            </div>
            <TeamColumn room={room} team="blue" myId={myId} isHost={isHost} />
          </div>
        ) : (
          <section className="sk shadow-ink overflow-hidden bg-paper-3">
            <header className="flex items-center justify-between border-b-[2.5px] border-ink bg-marker px-4 py-2 text-on-marker">
              <h2 className="font-display">Hỗn chiến · ai cũng là địch</h2>
              <span className="font-display text-sm tabular-nums">
                {room.members.length}/{room.max}
              </span>
            </header>
            <ul className="grid grid-cols-2 gap-3 p-3 sm:grid-cols-4">
              {Array.from({ length: room.max }).map((_, i) => {
                const m = room.members[i];
                return m ? <MemberCard key={m.id} m={m} room={room} myId={myId} isHost={isHost} i={i} /> : <EmptySlot key={`e${i}`} />;
              })}
            </ul>
          </section>
        )}

        <div className="flex flex-col gap-6">
          <Panel title="Trò chuyện" className="flex h-80 flex-col">
            <div ref={chatBox} className="scroll-sk -mx-1 flex-1 space-y-1 overflow-y-auto px-1">
              {chat.length === 0 && <p className="text-ink-soft">Chưa có tin nhắn nào.</p>}
              {chat.map((c, i) => (
                <p key={i} className={cn('leading-snug break-words', c.sys && 'text-sm text-ink-soft italic')}>
                  {!c.sys && <b className={c.from === me?.name ? 'text-crimson' : ''}>{c.from}: </b>}
                  {c.text}
                </p>
              ))}
            </div>
            <form
              className="mt-2 flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <input className="input-sk" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Nhắn gì đó…" maxLength={120} />
              <Button type="submit" size="sm" variant="blue" aria-label="Gửi">
                <Send size={16} strokeWidth={3} />
              </Button>
            </form>
          </Panel>

          <Panel tone="paper-2">
            <div className="mb-3 flex items-center justify-between">
              <span>
                Sẵn sàng:{' '}
                <b className="tabular-nums">
                  {readyCount}/{room.members.length}
                </b>
              </span>
              {isHost && (
                <Button size="sm" disabled={room.phase !== 'waiting' || room.members.length >= room.max} onClick={() => net.send({ t: 'addBot' })}>
                  <Bot size={14} strokeWidth={3} /> Thêm bot
                </Button>
              )}
            </div>
            <div className="grid gap-3">
              {isHost ? (
                <>
                  <Button variant="red" size="lg" disabled={!canStart || countdown !== null} onClick={() => net.send({ t: 'start' })}>
                    Bắt đầu trận
                  </Button>
                  {room.phase === 'waiting' && !canStart && (
                    <p className="text-center text-sm text-ink-soft">
                      {room.members.length < 2
                        ? 'Cần ít nhất 2 người, mời bạn bè hoặc thêm bot.'
                        : !teamsOk
                          ? 'Mỗi đội cần ít nhất 1 người.'
                          : 'Chờ mọi người sẵn sàng…'}
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Button
                    variant={me?.ready ? 'green' : 'yellow'}
                    size="lg"
                    disabled={room.phase !== 'waiting'}
                    onClick={() => net.send({ t: 'ready', ready: !me?.ready })}
                  >
                    {me?.ready ? '✓ Đã sẵn sàng' : 'Sẵn sàng'}
                  </Button>
                  <p className="text-center text-sm text-ink-soft">Chủ phòng sẽ bắt đầu khi mọi người sẵn sàng.</p>
                </>
              )}
              {room.phase === 'playing' && (
                <p className="text-center text-sm text-ink-soft">Trận đang diễn ra, bạn sẽ được thả vào ngay…</p>
              )}
            </div>
          </Panel>
        </div>
      </div>

      {countdown !== null && countdown > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40">
          <div key={countdown} className="anim-rise font-display text-[10rem] leading-none text-marker title-stroke">
            {countdown}
          </div>
        </div>
      )}
    </Page>
  );
}

function TeamColumn({ room, team, myId, isHost }: { room: RoomView; team: 'red' | 'blue'; myId: string | null; isHost: boolean }) {
  const accent = team === 'red' ? 'var(--crimson)' : 'var(--cobalt)';
  const perTeam = Math.ceil(room.max / 2);
  const members = room.members.filter((m) => m.team === team);
  const me = room.members.find((m) => m.id === myId);
  const canSwitch = room.phase === 'waiting' && me && me.team !== team && members.length < perTeam;
  return (
    <section className="sk shadow-ink overflow-hidden bg-paper-3">
      <header className="flex items-center justify-between border-b-[2.5px] border-ink px-4 py-2" style={{ background: accent }}>
        <h2 className="font-display text-on-accent">{team === 'red' ? 'Đội Đỏ' : 'Đội Xanh'}</h2>
        <span className="font-display text-sm text-on-accent tabular-nums">
          {members.length}/{perTeam}
        </span>
      </header>
      <ul className="grid grid-cols-2 gap-3 p-3">
        {Array.from({ length: perTeam }).map((_, i) => {
          const m = members[i];
          if (m) return <MemberCard key={m.id} m={m} room={room} myId={myId} isHost={isHost} i={i} facing={team === 'red' ? 1 : -1} />;
          return canSwitch ? (
            <li key={`e${i}`}>
              <button
                onClick={() => net.send({ t: 'team', team })}
                className="sk hatch focus-ring flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 border-dashed text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
              >
                <span className="font-display text-2xl">+</span>
                <span>Chuyển sang đội này</span>
              </button>
            </li>
          ) : (
            <EmptySlot key={`e${i}`} />
          );
        })}
      </ul>
    </section>
  );
}

function EmptySlot() {
  return (
    <li className="sk hatch flex min-h-40 items-center justify-center border-dashed text-ink-soft">
      <span>Ô trống</span>
    </li>
  );
}

function MemberCard({
  m,
  room,
  myId,
  isHost,
  i,
  facing = 1,
}: {
  m: RoomMember;
  room: RoomView;
  myId: string | null;
  isHost: boolean;
  i: number;
  facing?: 1 | -1;
}) {
  const you = m.id === myId;
  return (
    <li className={cn('sk relative flex flex-col items-center bg-paper p-2 pb-2.5', you && 'ring-[3px] ring-marker ring-offset-2 ring-offset-paper-3')}>
      {m.id === room.hostId && <Crown size={18} className="absolute top-1.5 left-1.5 text-marker" strokeWidth={3} aria-label="Chủ phòng" />}
      {m.bot && isHost && room.phase === 'waiting' && (
        <button
          className="absolute top-1 right-1 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-paper-3 hover:bg-crimson hover:text-on-accent"
          onClick={() => net.send({ t: 'kick', id: m.id })}
          aria-label={`Bỏ ${m.name}`}
        >
          <X size={12} strokeWidth={4} />
        </button>
      )}
      <div className="h-24 w-24">
        <StickFigure color={m.color} accessory={m.accessory} weapon={m.weapon} pose={m.ready ? 'taunt' : 'idle'} facing={facing} phase={i * 0.7} />
      </div>
      <span className="w-full truncate text-center leading-tight font-bold">
        {m.name}
        {you && ' (bạn)'}
      </span>
      <Badge tone={m.bot ? 'ink' : m.ready ? 'green' : 'paper'} className="mt-1 text-xs">
        {m.bot ? 'Bot' : m.id === room.hostId ? 'Chủ phòng' : m.ready ? 'Sẵn sàng' : 'Đang chọn…'}
      </Badge>
    </li>
  );
}

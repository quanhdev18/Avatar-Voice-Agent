import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation } from 'wouter';
import { Bot, Lock, Plus, Search, Shuffle, WifiOff } from 'lucide-react';
import { MAPS, type MapChoice, type RoomSummary } from '@workspace/game-core';

import { Page } from '@/components/Layout';
import { StickFigure } from '@/components/StickFigure';
import { Badge, Button, Modal, Panel, Tabs, Toggle } from '@/components/ui';
import { MODE_LABEL } from '@/lib/mock';
import { MapPicker, MapThumb, mapLabel } from '@/lib/maps';
import { cn } from '@/lib/utils';
import { net, useNet } from '@/net/client';

type Filter = 'all' | 'team' | 'ffa';


function Slots({ n, max }: { n: number; max: number }) {
  return (
    <span className="inline-flex items-center gap-1" aria-label={`${n}/${max} người chơi`}>
      {Array.from({ length: max }).map((_, i) => (
        <span key={i} className={cn('h-3 w-2 rounded-[2px] border-[1.5px] border-ink', i < n ? 'bg-ink' : 'bg-transparent')} />
      ))}
      <span className="ml-1 tabular-nums">
        {n}/{max}
      </span>
    </span>
  );
}

/** Navigate to the room page once the server has put us in a room. */
function useGoToRoomWhenJoined(active: boolean) {
  const [, nav] = useLocation();
  const room = useNet((s) => s.room);
  useEffect(() => {
    if (active && room) nav(`/room/${room.id}`);
  }, [active, room, nav]);
}

export default function Lobby() {
  const [, nav] = useLocation();
  const status = useNet((s) => s.status);
  const rooms = useNet((s) => s.rooms);
  const inRoom = useNet((s) => s.room);
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [hideFull, setHideFull] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [pwRoom, setPwRoom] = useState<RoomSummary | null>(null);
  const [waiting, setWaiting] = useState(false);
  const online = status === 'open';

  // Coming back to the lobby means leaving whatever room we were in.
  const leftOnMount = useRef(false);
  useEffect(() => {
    if (!leftOnMount.current && inRoom) net.send({ t: 'leave' });
    leftOnMount.current = true;
  }, [inRoom]);

  useGoToRoomWhenJoined(waiting);
  // stop waiting if the server answered with an error
  const error = useNet((s) => s.error);
  useEffect(() => setWaiting(false), [error]);

  const list = useMemo(
    () =>
      rooms
        .filter((r) => filter === 'all' || r.mode === filter)
        .filter((r) => !hideFull || r.players < r.max)
        .filter((r) => (r.name + r.host + r.id).toLowerCase().includes(q.toLowerCase())),
    [rooms, filter, q, hideFull],
  );

  const join = (r: RoomSummary, password?: string) => {
    if (r.locked && password === undefined) return setPwRoom(r);
    setWaiting(true);
    net.send({ t: 'join', roomId: r.id, password });
  };

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Sảnh chờ</h1>
          <p className="text-lg text-ink-soft">Chọn một phòng để vào, hoặc tự lập phòng cho hội bạn.</p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="yellow"
            disabled={!online}
            onClick={() => {
              setWaiting(true);
              net.send({ t: 'quick' });
            }}
          >
            <Shuffle size={18} strokeWidth={3} /> Ghép nhanh
          </Button>
          <Button variant="red" disabled={!online} onClick={() => setCreateOpen(true)}>
            <Plus size={18} strokeWidth={3} /> Tạo phòng
          </Button>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
        <Panel className="p-0">
          <div className="flex flex-wrap items-center gap-3 border-b-[2.5px] border-ink p-3">
            <Tabs<Filter>
              value={filter}
              onChange={setFilter}
              options={[
                { value: 'all', label: 'Tất cả' },
                { value: 'team', label: MODE_LABEL.team },
                { value: 'ffa', label: MODE_LABEL.ffa },
              ]}
            />
            <label className="relative ml-auto min-w-48 flex-1 sm:max-w-64">
              <Search size={18} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-soft" />
              <input className="input-sk pl-9" placeholder="Tìm phòng, chủ phòng, mã…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
          </div>

          {!online ? (
            <OfflineState status={status} />
          ) : (
            <>
              <div className="hidden grid-cols-[1fr_110px_160px_150px_96px] gap-3 border-b-2 border-dashed border-ink/30 px-4 py-2 font-display text-[11px] text-ink-soft uppercase md:grid">
                <span>Phòng</span>
                <span>Chế độ</span>
                <span>Bản đồ</span>
                <span>Người chơi</span>
                <span />
              </div>
              <ul className="divide-y-2 divide-dashed divide-ink/20">
                {list.map((r, i) => {
                  const full = r.players >= r.max;
                  const label = full ? 'Đầy' : r.phase === 'playing' ? 'Vào giữa trận' : 'Vào';
                  const btn = (
                    <Button size="sm" variant={full ? 'paper' : 'blue'} disabled={full || waiting} onClick={() => join(r)}>
                      {label}
                    </Button>
                  );
                  return (
                    <li
                      key={r.id}
                      className="anim-slide-in grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-paper-2 md:grid-cols-[1fr_110px_160px_150px_96px]"
                      style={{ animationDelay: `${i * 40}ms` }}
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          {r.locked && <Lock size={15} strokeWidth={3} className="shrink-0" aria-label="Có mật khẩu" />}
                          <span className="truncate text-lg font-bold">{r.name}</span>
                        </div>
                        <div className="text-sm text-ink-soft">
                          #{r.id} · chủ phòng {r.host}
                          {r.phase !== 'waiting' && <span className="ml-2 text-crimson">● đang đấu</span>}
                        </div>
                      </div>
                      <div className="md:hidden">{btn}</div>
                      <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm md:contents md:text-base">
                        <span>
                          <Badge tone={r.mode === 'team' ? 'blue' : 'red'}>{MODE_LABEL[r.mode]}</Badge>
                        </span>
                        <span className="flex min-w-0 items-center gap-2">
                          <MapThumb choice={r.map} className="hidden h-7 w-12 shrink-0 rounded-[4px] border-2 border-ink sm:block" />
                          <span className="truncate">{mapLabel(r.map)}</span>
                        </span>
                        <Slots n={r.players} max={r.max} />
                      </div>
                      <div className="hidden justify-end md:flex">{btn}</div>
                    </li>
                  );
                })}
                {list.length === 0 && (
                  <li className="flex flex-col items-center gap-2 p-10 text-center text-lg text-ink-soft">
                    <div className="h-28 w-28">
                      <StickFigure pose="taunt" />
                    </div>
                    {rooms.length === 0 ? 'Chưa có phòng nào đang mở.' : 'Không có phòng khớp bộ lọc.'}
                    <button className="text-crimson underline" onClick={() => setCreateOpen(true)}>
                      Tự tạo một phòng?
                    </button>
                  </li>
                )}
              </ul>
            </>
          )}
        </Panel>

        <aside className="space-y-6">
          <Panel title="Bộ lọc" tone="paper-2">
            <Toggle label="Ẩn phòng đã đầy" checked={hideFull} onChange={setHideFull} />
          </Panel>
          <Panel title="Chơi một mình" tape>
            <p className="mb-3 text-ink-soft">Luyện tay với 5 bot, không cần mạng.</p>
            <Button className="w-full" onClick={() => nav('/play')}>
              <Bot size={18} strokeWidth={3} /> Đấu với bot
            </Button>
          </Panel>
        </aside>
      </div>

      <CreateRoomModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreate={(opts) => {
          setWaiting(true);
          net.send({ t: 'create', ...opts });
          setCreateOpen(false);
        }}
      />
      <PasswordModal
        room={pwRoom}
        onClose={() => setPwRoom(null)}
        onSubmit={(pw) => {
          if (pwRoom) join(pwRoom, pw);
          setPwRoom(null);
        }}
      />
    </Page>
  );
}

function OfflineState({ status }: { status: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <WifiOff size={40} strokeWidth={2.5} className="text-crimson" />
      <div className="font-display text-xl">{status === 'connecting' ? 'Đang kết nối máy chủ…' : 'Chưa kết nối được máy chủ'}</div>
      <p className="max-w-sm text-ink-soft">Danh sách phòng sẽ hiện khi kết nối xong. Trong lúc chờ, bạn vẫn có thể đấu với bot.</p>
      <Button size="sm" onClick={() => net.retry()} disabled={status === 'connecting'}>
        Thử lại
      </Button>
    </div>
  );
}

function PasswordModal({ room, onClose, onSubmit }: { room: RoomSummary | null; onClose: () => void; onSubmit: (pw: string) => void }) {
  const [pw, setPw] = useState('');
  return (
    <Modal open={!!room} onClose={onClose} title="Phòng có mật khẩu">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(pw);
          setPw('');
        }}
      >
        <p>
          Nhập mật khẩu để vào <b>{room?.name}</b>.
        </p>
        <input className="input-sk" type="password" autoFocus value={pw} onChange={(e) => setPw(e.target.value)} maxLength={32} />
        <div className="flex justify-end gap-3">
          <Button type="button" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="blue" disabled={!pw}>
            Vào phòng
          </Button>
        </div>
      </form>
    </Modal>
  );
}

type CreateOpts = { name: string; mode: 'team' | 'ffa'; map: MapChoice; max: 2 | 4 | 6 | 8; password?: string };

function CreateRoomModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (o: CreateOpts) => void }) {
  const [name, setName] = useState('Phòng của tui');
  const [mode, setMode] = useState<'team' | 'ffa' | 'koth'>('team');
  const [map, setMap] = useState<MapChoice>('notebook');
  const [max, setMax] = useState<2 | 4 | 6 | 8>(8);
  const [priv, setPriv] = useState(false);
  const [pw, setPw] = useState('');
  const valid = name.trim().length > 0 && mode !== 'koth' && (!priv || pw.length > 0);
  return (
    <Modal open={open} onClose={onClose} title="Tạo phòng mới">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (valid && (mode === 'team' || mode === 'ffa')) onCreate({ name: name.trim(), mode, map, max, password: priv ? pw : undefined });
        }}
      >
        <label className="block">
          <span className="mb-1 block">Tên phòng</span>
          <input className="input-sk" value={name} onChange={(e) => setName(e.target.value)} maxLength={32} />
        </label>
        <div>
          <span className="mb-1 block">Chế độ</span>
          <Tabs<'team' | 'ffa' | 'koth'>
            value={mode}
            onChange={setMode}
            options={[
              { value: 'team', label: MODE_LABEL.team },
              { value: 'ffa', label: MODE_LABEL.ffa },
              { value: 'koth', label: `${MODE_LABEL.koth} (sắp có)` },
            ]}
          />
          {mode === 'koth' && <p className="mt-1 text-sm text-crimson">Chế độ Giữ đồi chưa mở, chọn chế độ khác nhé.</p>}
        </div>
        <div>
          <span className="mb-1 block">Bản đồ</span>
          <MapPicker value={map} onChange={setMap} compact />
          <p className="mt-2 text-sm text-ink-soft">{map === 'random' ? 'Bốc thăm khi trận bắt đầu.' : MAPS[map].desc} Có thể đổi lại trong phòng chờ.</p>
        </div>
        <div>
          <span className="mb-1 block">Số người tối đa</span>
          <Tabs
            value={String(max)}
            onChange={(v) => setMax(Number(v) as 2 | 4 | 6 | 8)}
            options={['2', '4', '6', '8'].map((v) => ({ value: v, label: v }))}
          />
        </div>
        <Toggle label="Phòng kín (cần mật khẩu)" checked={priv} onChange={setPriv} />
        {priv && <input className="input-sk" type="password" placeholder="Mật khẩu" value={pw} onChange={(e) => setPw(e.target.value)} maxLength={32} />}
        <div className="flex justify-end gap-3 pt-2">
          <Button type="button" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" variant="red" disabled={!valid}>
            Tạo phòng
          </Button>
        </div>
      </form>
    </Modal>
  );
}

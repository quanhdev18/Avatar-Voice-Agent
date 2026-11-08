import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { Lock, Plus, RefreshCw, Search, Shuffle, Signal } from 'lucide-react';

import { Page } from '@/components/Layout';
import { Badge, Button, Modal, Panel, Tabs, Toggle } from '@/components/ui';
import { MAPS, MODE_LABEL, ROOMS, type GameMode, type Room } from '@/lib/mock';
import { cn } from '@/lib/utils';

type Filter = 'all' | GameMode;

function PingBadge({ ping }: { ping: number }) {
  const tone = ping < 35 ? 'text-mint' : ping < 55 ? 'text-marker' : 'text-crimson';
  return (
    <span className={cn('inline-flex items-center gap-1 tabular-nums', tone)}>
      <Signal size={16} strokeWidth={3} />
      <span className="text-ink">{ping}ms</span>
    </span>
  );
}

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

export default function Lobby() {
  const [, nav] = useLocation();
  const [filter, setFilter] = useState<Filter>('all');
  const [q, setQ] = useState('');
  const [hideFull, setHideFull] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [spin, setSpin] = useState(false);

  const rooms = useMemo(
    () =>
      ROOMS.filter((r) => filter === 'all' || r.mode === filter)
        .filter((r) => !hideFull || r.players < r.max)
        .filter((r) => (r.name + r.host + r.id).toLowerCase().includes(q.toLowerCase())),
    [filter, q, hideFull],
  );

  const join = (r: Room) => nav(`/room/${r.id}`);

  return (
    <Page>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl">Sảnh chờ</h1>
          <p className="text-lg text-ink-soft">Chọn một phòng để vào, hoặc tự lập phòng cho hội bạn.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="yellow" onClick={() => nav('/room/' + ROOMS[0].id)}>
            <Shuffle size={18} strokeWidth={3} /> Ghép nhanh
          </Button>
          <Button variant="red" onClick={() => setCreateOpen(true)}>
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
                { value: 'koth', label: MODE_LABEL.koth },
              ]}
            />
            <label className="relative ml-auto min-w-48 flex-1 sm:max-w-64">
              <Search size={18} className="absolute top-1/2 left-2.5 -translate-y-1/2 text-ink-soft" />
              <input className="input-sk pl-9" placeholder="Tìm phòng, chủ phòng, mã…" value={q} onChange={(e) => setQ(e.target.value)} />
            </label>
            <button
              className="btn h-10 w-10 bg-paper-3 p-0"
              aria-label="Làm mới"
              onClick={() => {
                setSpin(true);
                setTimeout(() => setSpin(false), 600);
              }}
            >
              <RefreshCw size={18} strokeWidth={2.5} className={spin ? 'animate-spin' : ''} />
            </button>
          </div>

          {/* table header (desktop) */}
          <div className="hidden grid-cols-[1fr_110px_120px_120px_80px_96px] gap-3 border-b-2 border-dashed border-ink/30 px-4 py-2 font-display text-[11px] text-ink-soft uppercase md:grid">
            <span>Phòng</span>
            <span>Chế độ</span>
            <span>Bản đồ</span>
            <span>Người chơi</span>
            <span>Ping</span>
            <span />
          </div>
          <ul className="divide-y-2 divide-dashed divide-ink/20">
            {rooms.map((r, i) => {
              const full = r.players >= r.max;
              return (
                <li
                  key={r.id}
                  className="anim-slide-in grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 px-4 py-3 transition-colors hover:bg-paper-2 md:grid-cols-[1fr_110px_120px_120px_80px_96px]"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      {r.locked && <Lock size={15} strokeWidth={3} className="shrink-0" aria-label="Có mật khẩu" />}
                      <span className="truncate text-lg font-bold">{r.name}</span>
                    </div>
                    <div className="text-sm text-ink-soft">
                      #{r.id} · chủ phòng {r.host}
                    </div>
                  </div>
                  <div className="md:hidden">
                    <Button size="sm" variant={full || r.status === 'playing' ? 'paper' : 'blue'} disabled={full} onClick={() => join(r)}>
                      {r.status === 'playing' ? 'Xem' : 'Vào'}
                    </Button>
                  </div>
                  <div className="col-span-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm md:contents md:text-base">
                    <span>
                      <Badge tone={r.mode === 'team' ? 'blue' : r.mode === 'ffa' ? 'red' : 'yellow'}>{MODE_LABEL[r.mode]}</Badge>
                    </span>
                    <span className="truncate">{r.map}</span>
                    <Slots n={r.players} max={r.max} />
                    <PingBadge ping={r.ping} />
                  </div>
                  <div className="hidden justify-end md:flex">
                    <Button size="sm" variant={full || r.status === 'playing' ? 'paper' : 'blue'} disabled={full} onClick={() => join(r)}>
                      {full ? 'Đầy' : r.status === 'playing' ? 'Xem' : 'Vào'}
                    </Button>
                  </div>
                </li>
              );
            })}
            {rooms.length === 0 && (
              <li className="p-10 text-center text-lg text-ink-soft">
                Không tìm thấy phòng nào… <button className="text-crimson underline" onClick={() => setCreateOpen(true)}>tự tạo một phòng?</button>
              </li>
            )}
          </ul>
        </Panel>

        <aside className="space-y-6">
          <Panel title="Bộ lọc" tone="paper-2">
            <Toggle label="Ẩn phòng đã đầy" checked={hideFull} onChange={setHideFull} />
          </Panel>
          <Panel title="Bạn bè online" tape>
            <ul className="space-y-2">
              {[
                ['MeoMeo', 'Đang ở sảnh', true],
                ['KhoaBu', 'Trong trận · Núi lửa', true],
                ['GaCon', 'Offline 2 giờ', false],
              ].map(([n, s, on]) => (
                <li key={n as string} className="flex items-center gap-2">
                  <span className={cn('h-3 w-3 rounded-full border-2 border-ink', on ? 'bg-mint' : 'bg-paper-2')} />
                  <span className="flex-1">
                    <span className="block leading-tight">{n}</span>
                    <span className="block text-sm text-ink-soft">{s}</span>
                  </span>
                  {on && <Button size="sm">Mời</Button>}
                </li>
              ))}
            </ul>
          </Panel>
        </aside>
      </div>

      <CreateRoomModal open={createOpen} onClose={() => setCreateOpen(false)} onCreate={() => nav('/room/NEW1')} />
    </Page>
  );
}

function CreateRoomModal({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: () => void }) {
  const [mode, setMode] = useState<GameMode>('team');
  const [map, setMap] = useState(MAPS[0].id);
  const [max, setMax] = useState(8);
  const [priv, setPriv] = useState(false);
  return (
    <Modal open={open} onClose={onClose} title="Tạo phòng mới">
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block">Tên phòng</span>
          <input className="input-sk" defaultValue="Phòng của tui" maxLength={32} />
        </label>
        <div>
          <span className="mb-1 block">Chế độ</span>
          <Tabs<GameMode>
            value={mode}
            onChange={setMode}
            options={(Object.keys(MODE_LABEL) as GameMode[]).map((m) => ({ value: m, label: MODE_LABEL[m] }))}
          />
        </div>
        <div>
          <span className="mb-1 block">Bản đồ</span>
          <div className="grid grid-cols-2 gap-3">
            {MAPS.map((m) => (
              <button
                key={m.id}
                onClick={() => setMap(m.id)}
                className={cn(
                  'sk focus-ring p-2 text-left transition-transform',
                  map === m.id ? 'shadow-ink -translate-y-0.5 bg-marker text-on-marker' : 'bg-paper-3 hover:bg-paper-2',
                )}
              >
                <span className="mb-1 block h-2 w-10 rounded-full border-2 border-ink" style={{ background: m.color }} />
                <span className="block font-bold leading-tight">{m.name}</span>
                <span className="block text-sm opacity-75">{m.desc}</span>
              </button>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-1 block">Số người tối đa</span>
          <Tabs
            value={String(max)}
            onChange={(v) => setMax(Number(v))}
            options={['2', '4', '6', '8'].map((v) => ({ value: v, label: v }))}
          />
        </div>
        <Toggle label="Phòng kín (cần mật khẩu)" checked={priv} onChange={setPriv} />
        {priv && <input className="input-sk" type="password" placeholder="Mật khẩu" />}
        <div className="flex justify-end gap-3 pt-2">
          <Button onClick={onClose}>Huỷ</Button>
          <Button variant="red" onClick={onCreate}>
            Tạo phòng
          </Button>
        </div>
      </div>
    </Modal>
  );
}

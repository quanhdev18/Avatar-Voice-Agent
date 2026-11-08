import { useEffect, useRef, useState } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowLeft, Copy, Crown, Send, UserPlus } from 'lucide-react';

import { Page } from '@/components/Layout';
import { StickFigure } from '@/components/StickFigure';
import { Badge, Burst, Button, Panel } from '@/components/ui';
import { BOTS, CHAT_SEED, MAPS, ROOMS } from '@/lib/mock';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

type Slot = {
  name: string;
  color: string;
  accessory: (typeof BOTS)[number]['accessory'];
  weapon: (typeof BOTS)[number]['weapon'];
  ready: boolean;
  host?: boolean;
  you?: boolean;
} | null;

const TEAM_SIZE = 4;

export default function Room() {
  const { id } = useParams<{ id: string }>();
  const [, nav] = useLocation();
  const { profile } = useStore();
  const room = ROOMS.find((r) => r.id === id);
  const roomName = room?.name ?? 'Phòng của tui';
  const map = MAPS.find((m) => m.name === room?.map) ?? MAPS[0];

  const me = { name: profile.name, color: profile.color, accessory: profile.accessory, weapon: profile.weapon, you: true };
  const [red, setRed] = useState<Slot[]>(() => [
    { ...BOTS[0], ready: true, host: true },
    { ...me, ready: false },
    { ...BOTS[1], ready: false },
    null,
  ]);
  const [blue, setBlue] = useState<Slot[]>(() => [{ ...BOTS[2], ready: true }, { ...BOTS[3], ready: false }, null, null]);
  const [chat, setChat] = useState(CHAT_SEED);
  const [msg, setMsg] = useState('');
  const [count, setCount] = useState<number | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  // bots get ready over time
  useEffect(() => {
    const t = setInterval(() => {
      const flip = (s: Slot[]) => {
        const idx = s.findIndex((x) => x && !x.you && !x.ready);
        if (idx < 0) return s;
        const n = [...s];
        n[idx] = { ...n[idx]!, ready: true };
        return n;
      };
      setRed(flip);
      setBlue(flip);
    }, 2500);
    return () => clearInterval(t);
  }, []);

  useEffect(() => chatEnd.current?.scrollIntoView({ block: 'nearest' }), [chat]);

  useEffect(() => {
    if (count === null) return;
    if (count === 0) {
      nav('/play');
      return;
    }
    const t = setTimeout(() => setCount((c) => (c ?? 1) - 1), 800);
    return () => clearTimeout(t);
  }, [count, nav]);

  const all = [...red, ...blue].filter(Boolean) as NonNullable<Slot>[];
  const myReady = all.find((p) => p.you)?.ready ?? false;
  const allReady = all.every((p) => p.ready);

  const toggleReady = () => {
    const upd = (s: Slot[]) => s.map((x) => (x?.you ? { ...x, ready: !x.ready } : x));
    setRed(upd);
    setBlue(upd);
  };

  const moveTo = (team: 'red' | 'blue', idx: number) => {
    const mine = all.find((p) => p.you)!;
    const strip = (s: Slot[]) => s.map((x) => (x?.you ? null : x));
    const place = (s: Slot[]) => s.map((x, i) => (i === idx ? { ...mine, ready: false } : x));
    if (team === 'red') {
      setBlue(strip);
      setRed((s) => place(strip(s)));
    } else {
      setRed(strip);
      setBlue((s) => place(strip(s)));
    }
  };

  const send = () => {
    if (!msg.trim()) return;
    setChat((c) => [...c, { from: profile.name, text: msg.trim(), sys: false }]);
    setMsg('');
  };

  return (
    <Page>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={() => nav('/lobby')} aria-label="Về sảnh">
            <ArrowLeft size={16} strokeWidth={3} />
          </Button>
          <div>
            <h1 className="font-display text-2xl leading-tight sm:text-3xl">{roomName}</h1>
            <div className="flex flex-wrap items-center gap-2 text-ink-soft">
              <span>Mã phòng</span>
              <button
                className="sk inline-flex items-center gap-1 bg-paper-3 px-2 font-display text-sm text-ink"
                onClick={() => navigator.clipboard?.writeText(id).catch(() => {})}
                aria-label="Sao chép mã phòng"
              >
                #{id} <Copy size={13} />
              </button>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge tone="blue">Đồng đội 4v4</Badge>
          <Badge>Bản đồ: {map.name}</Badge>
          <Badge>3 phút · 10 K.O</Badge>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="relative grid gap-6 sm:grid-cols-2">
          <TeamColumn team="red" slots={red} onJoin={(i) => moveTo('red', i)} />
          <div className="pointer-events-none absolute top-1/2 left-1/2 z-10 hidden -translate-x-1/2 -translate-y-1/2 sm:block">
            <Burst text="VS" size={90} />
          </div>
          <TeamColumn team="blue" slots={blue} onJoin={(i) => moveTo('blue', i)} />
        </div>

        <div className="flex flex-col gap-6">
          <Panel title="Trò chuyện" className="flex h-80 flex-col">
            <div className="scroll-sk -mx-1 flex-1 space-y-1 overflow-y-auto px-1">
              {chat.map((c, i) => (
                <p key={i} className={cn('leading-snug', c.sys && 'text-sm text-ink-soft italic')}>
                  {!c.sys && <b className={c.from === profile.name ? 'text-crimson' : ''}>{c.from}: </b>}
                  {c.text}
                </p>
              ))}
              <div ref={chatEnd} />
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
                Sẵn sàng: <b className="tabular-nums">{all.filter((p) => p.ready).length}/{all.length}</b>
              </span>
              <Button size="sm">
                <UserPlus size={14} strokeWidth={3} /> Mời
              </Button>
            </div>
            <div className="grid gap-3">
              <Button variant={myReady ? 'green' : 'yellow'} size="lg" onClick={toggleReady}>
                {myReady ? '✓ Đã sẵn sàng' : 'Sẵn sàng'}
              </Button>
              <Button variant="red" size="lg" disabled={!allReady || count !== null} onClick={() => setCount(3)}>
                Bắt đầu trận
              </Button>
              {!allReady && <p className="text-center text-sm text-ink-soft">Chờ mọi người sẵn sàng…</p>}
            </div>
          </Panel>
        </div>
      </div>

      {count !== null && count > 0 && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40">
          <div key={count} className="anim-rise font-display text-[10rem] leading-none text-marker title-stroke">
            {count}
          </div>
        </div>
      )}
    </Page>
  );
}

function TeamColumn({ team, slots, onJoin }: { team: 'red' | 'blue'; slots: Slot[]; onJoin: (i: number) => void }) {
  const accent = team === 'red' ? 'var(--crimson)' : 'var(--cobalt)';
  return (
    <section className="sk shadow-ink overflow-hidden bg-paper-3">
      <header className="flex items-center justify-between border-b-[2.5px] border-ink px-4 py-2" style={{ background: accent }}>
        <h2 className="font-display text-on-accent">{team === 'red' ? 'Đội Đỏ' : 'Đội Xanh'}</h2>
        <span className="font-display text-sm text-on-accent tabular-nums">
          {slots.filter(Boolean).length}/{TEAM_SIZE}
        </span>
      </header>
      <ul className="grid grid-cols-2 gap-3 p-3">
        {slots.map((s, i) =>
          s ? (
            <li
              key={i}
              className={cn('sk relative flex flex-col items-center bg-paper p-2 pb-2.5', s.you && 'ring-[3px] ring-marker ring-offset-2 ring-offset-paper-3')}
            >
              {s.host && <Crown size={18} className="absolute top-1.5 left-1.5 text-marker" strokeWidth={3} aria-label="Chủ phòng" />}
              <div className="h-24 w-24">
                <StickFigure
                  color={s.color}
                  accessory={s.accessory}
                  weapon={s.weapon}
                  pose={s.ready ? 'taunt' : 'idle'}
                  facing={team === 'red' ? 1 : -1}
                  phase={i * 0.7}
                />
              </div>
              <span className="w-full truncate text-center leading-tight font-bold">
                {s.name}
                {s.you && ' (bạn)'}
              </span>
              <Badge tone={s.ready ? 'green' : 'paper'} className="mt-1 text-xs">
                {s.ready ? 'Sẵn sàng' : 'Đang chọn…'}
              </Badge>
            </li>
          ) : (
            <li key={i}>
              <button
                onClick={() => onJoin(i)}
                className="sk hatch focus-ring flex h-full min-h-40 w-full flex-col items-center justify-center gap-1 border-dashed text-ink-soft transition-colors hover:bg-paper-2 hover:text-ink"
              >
                <span className="font-display text-2xl">+</span>
                <span>Vào ô này</span>
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

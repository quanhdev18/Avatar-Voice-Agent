import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useLocation, useParams } from 'wouter';
import { ArrowBigLeft, ArrowBigRight, ArrowBigUp, Pause, Wifi } from 'lucide-react';
import {
  DT,
  GROUND,
  H,
  PLATFORMS,
  W,
  ATTACK,
  botInput,
  createMatch,
  newBrain,
  stepMatch,
  winScore,
  type BotBrain,
  type Fighter,
  type GameEvent,
  type Match,
} from '@workspace/game-core';

import { ControlsList, SettingsModal } from '@/components/Layout';
import { StickFigure, type Pose } from '@/components/StickFigure';
import { Bar, Burst, Button, Head, IconButton, Kbd, Modal, hpColor } from '@/components/ui';
import { BOTS } from '@/lib/mock';
import { setLastResult, useStore, type MatchResult, type Profile } from '@/lib/store';
import { cn, formatTime } from '@/lib/utils';
import { net, takeInput, useNet, type InputState, type MatchView } from '@/net/client';

const FIG_K = 0.85; // viewBox → world scale
const HIT_WORDS = ['BỐP!', 'HỰ!', 'BỤP!', 'RẮC!', 'ỐI!'];

/* ------------------------------------------------------------------ */
/* Match sources: local bots (offline demo) or the game server         */
/* ------------------------------------------------------------------ */
interface MatchSource {
  frame(dt: number, input: InputState): GameEvent[];
  view(): MatchView | null;
}

class LocalSource implements MatchSource {
  readonly m: Match;
  private brains = new Map<string, BotBrain>();
  private acc = 0;
  constructor(profile: Profile) {
    this.m = createMatch('team', [
      { id: 'me', name: profile.name, color: profile.color, accessory: profile.accessory, weapon: profile.weapon, team: 'red', bot: false },
      ...BOTS.slice(0, 5).map((b, i) => ({ ...b, id: `bot${i}`, team: i < 2 ? 'red' : 'blue', bot: true })),
    ]);
    for (const f of this.m.fighters) if (f.bot) this.brains.set(f.id, newBrain());
    this.m.fighters[0]!.energy = 60;
  }
  frame(dt: number, input: InputState) {
    const events: GameEvent[] = [];
    this.acc = Math.min(this.acc + dt, DT * 5);
    while (this.acc >= DT) {
      this.acc -= DT;
      const inputs = { me: takeInput(input) } as Record<string, ReturnType<typeof takeInput>>;
      for (const f of this.m.fighters) if (f.bot) inputs[f.id] = botInput(this.m, f, this.brains.get(f.id)!);
      events.push(...stepMatch(this.m, inputs));
    }
    return events;
  }
  view(): MatchView {
    const m = this.m;
    return { mode: m.mode, meId: 'me', fighters: m.fighters, score: m.score, timeLeft: m.timeLeft, intro: m.intro };
  }
  result(): MatchResult {
    const m = this.m;
    return {
      mode: m.mode,
      winner: m.winner ?? 'draw',
      score: { ...m.score },
      durationSec: Math.round(m.duration - m.timeLeft),
      players: m.fighters.map((f) => ({
        id: f.id,
        name: f.name,
        team: f.team,
        color: f.color,
        accessory: f.accessory,
        weapon: f.weapon,
        kos: f.kos,
        falls: f.falls,
        damage: Math.round(f.damage),
        you: f.id === 'me',
      })),
    };
  }
}

function poseOf(f: Fighter): Pose {
  if (f.koT > 0) return 'ko';
  if (f.hurtT > 0) return 'hurt';
  if (f.action === 'punch' || f.action === 'super') return 'punch';
  if (f.action === 'kick') return 'kick';
  if (f.action === 'block') return 'block';
  if (!f.onGround) return 'jump';
  if (Math.abs(f.vx) > 30) return 'run';
  return 'idle';
}

const emptyInput = (): InputState => ({ left: false, right: false, jump: false, block: false, punch: false, kick: false, super: false });

type Popup = { id: number; x: number; y: number; text: string; at: number; big: boolean; block: boolean };
type Feed = { id: number; killer: string; victim: string; kTeam: string; vTeam: string; at: number };
type Wave = { id: number; x: number; y: number; at: number };

function winnerLabel(mode: 'team' | 'ffa', winner: string, nameOf: (id: string) => string) {
  if (winner === 'draw') return 'Hoà!';
  if (mode === 'team') return winner === 'red' ? 'Đội Đỏ thắng!' : 'Đội Xanh thắng!';
  return `${nameOf(winner)} thắng!`;
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */
export default function Play({ online = false }: { online?: boolean }) {
  const [, nav] = useLocation();
  const params = useParams<{ id?: string }>();
  const { profile, settings } = useStore();

  const netMatch = useNet((s) => s.match);
  const netResult = useNet((s) => s.result);
  const netStatus = useNet((s) => s.status);
  const ping = useNet((s) => s.ping);

  const local = useMemo(() => (online ? null : new LocalSource(profile)), [online]); // eslint-disable-line react-hooks/exhaustive-deps
  const source: MatchSource | null = online ? netMatch : local;

  const input = useRef<InputState>(emptyInput());
  const popups = useRef<Popup[]>([]);
  const feed = useRef<Feed[]>([]);
  const waves = useRef<Wave[]>([]);
  const uid = useRef(1);
  const viewRef = useRef<MatchView | null>(null);

  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [over, setOver] = useState<MatchResult | null>(null);
  const [touch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
  const menuOpen = paused || settingsOpen;
  const menuRef = useRef(menuOpen);
  menuRef.current = menuOpen;
  const shakeRef = useRef(settings.shake);
  shakeRef.current = settings.shake;

  /* ---------------- online: follow server state ---------------- */
  useEffect(() => {
    if (!online) return;
    if (netResult && !over) {
      setOver(netResult);
      return;
    }
    if (!netMatch && !netResult) nav(`/room/${params.id ?? ''}`, { replace: true });
  }, [online, netMatch, netResult, over, nav, params.id]);

  // after the "KẾT THÚC" banner, go to results
  useEffect(() => {
    if (!over) return;
    setLastResult(over);
    const t = setTimeout(() => nav('/results'), 2200);
    return () => clearTimeout(t);
  }, [over, nav]);

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    if (!source) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const clock = now / 1000;
      // Offline: the menu pauses the game. Online: the server keeps going, we just stop sending keys.
      if (!(menuRef.current && !online)) {
        const events = source.frame(dt, menuRef.current ? emptyInput() : input.current);
        const v = source.view();
        viewRef.current = v;
        if (v) handleEvents(events, v, clock);
        if (local?.m.ended && !over) setOver(local.result());
      }
      popups.current = popups.current.filter((p) => clock - p.at < 0.9);
      waves.current = waves.current.filter((w) => clock - w.at < 0.6);
      feed.current = feed.current.filter((f) => clock - f.at < 6);
      setFrame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, online]);

  function handleEvents(events: GameEvent[], v: MatchView, clock: number) {
    const byId = (id: string) => v.fighters.find((f) => f.id === id);
    for (const e of events) {
      if (e.k === 'hit') {
        popups.current.push({
          id: uid.current++,
          x: e.x,
          y: e.y,
          at: clock,
          big: e.big,
          block: e.blocked,
          text: e.blocked ? 'CHẶN!' : e.big ? 'SIÊU CẤP!' : HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)]!,
        });
        if (e.v === v.meId && !e.blocked && shakeRef.current) setShakeKey((k) => k + 1);
      } else if (e.k === 'ko') {
        const a = byId(e.a);
        const b = byId(e.v);
        feed.current.unshift({ id: uid.current++, killer: a?.name ?? '?', victim: b?.name ?? '?', kTeam: a?.team ?? '', vTeam: b?.team ?? '', at: clock });
        feed.current = feed.current.slice(0, 5);
      } else if (e.k === 'super') {
        waves.current.push({ id: uid.current++, x: e.x, y: e.y, at: clock });
      }
    }
  }

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const map: Record<string, keyof InputState> = {
      KeyA: 'left',
      ArrowLeft: 'left',
      KeyD: 'right',
      ArrowRight: 'right',
      KeyW: 'jump',
      ArrowUp: 'jump',
      Space: 'jump',
      KeyJ: 'punch',
      KeyK: 'kick',
      KeyL: 'block',
      KeyQ: 'super',
    };
    const oneShot = (k: keyof InputState) => k === 'punch' || k === 'kick' || k === 'super';
    const down = (e: KeyboardEvent) => {
      if (e.code === 'Tab') {
        e.preventDefault();
        setShowBoard(true);
        return;
      }
      if (e.code === 'Escape') {
        setPaused((p) => !p);
        return;
      }
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      const k = map[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat && oneShot(k)) return;
      input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setShowBoard(false);
      const k = map[e.code];
      if (k && !oneShot(k)) input.current[k] = false;
    };
    const blur = () => (input.current = emptyInput());
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);

  const press = (k: keyof InputState, v = true) => () => {
    input.current[k] = v;
  };

  const leave = () => {
    if (online) net.send({ t: 'leave' });
    nav('/lobby');
  };

  const v = viewRef.current;
  const clock = performance.now() / 1000;

  if (!v) {
    return (
      <div className="grid min-h-dvh place-items-center p-6 text-center">
        <div>
          <div className="font-display text-3xl">{netStatus === 'open' ? 'Đang tải trận…' : 'Đang kết nối lại máy chủ…'}</div>
          <Button className="mt-6" onClick={leave}>
            Về sảnh
          </Button>
        </div>
      </div>
    );
  }

  const me = v.fighters.find((f) => f.id === v.meId);
  const nameOf = (id: string) => v.fighters.find((f) => f.id === id)?.name ?? over?.players.find((p) => p.id === id)?.name ?? '?';

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-2 py-3 select-none">
      {/* ---------- top HUD ---------- */}
      <div className="flex w-full max-w-[1100px] flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <div className="order-2 w-full sm:order-1 sm:w-auto sm:flex-1">{me && <PlayerCard f={me} />}</div>
        <div className="order-1 flex flex-col items-center gap-1 sm:order-2">
          <div className="flex items-stretch">
            {v.mode === 'team' && <TeamScore team="red" value={v.score.red ?? 0} />}
            <div className="sk z-10 -mx-1 bg-paper-3 px-2.5 py-1 text-center shadow-ink-sm sm:px-4">
              <div className={cn('font-display text-2xl tabular-nums', v.timeLeft < 30 && 'text-crimson')}>{formatTime(v.timeLeft)}</div>
            </div>
            {v.mode === 'team' && <TeamScore team="blue" value={v.score.blue ?? 0} />}
          </div>
          <div className="hidden text-sm text-ink-soft sm:block">
            {v.mode === 'team' ? `Đội đầu tiên đạt ${winScore('team')} K.O thắng` : `Hỗn chiến · ai đạt ${winScore('ffa')} K.O trước thắng`}
          </div>
        </div>
        <div className="order-1 flex items-start justify-end gap-2 sm:order-3 sm:flex-1">
          <KillFeed items={feed.current} />
          {online && (
            <span className={cn('sk hidden items-center gap-1 bg-paper-3 px-2 py-1 text-sm tabular-nums sm:inline-flex', netStatus !== 'open' && 'text-crimson')}>
              <Wifi size={14} strokeWidth={3} /> {netStatus === 'open' ? `${ping ?? '–'}ms` : 'mất kết nối'}
            </span>
          )}
          <IconButton aria-label="Tạm dừng" onClick={() => setPaused(true)}>
            <Pause size={18} strokeWidth={3} />
          </IconButton>
        </div>
      </div>

      {touch && <p className="text-center text-sm text-ink-soft landscape:hidden">↻ Xoay ngang điện thoại để chơi thoải mái hơn</p>}

      {/* ---------- arena ---------- */}
      <div
        key={shakeKey}
        className={cn('sk shadow-ink-lg relative overflow-hidden bg-paper-3', shakeKey > 0 && 'anim-shake')}
        style={{ width: 'min(100%, 1100px, calc((100dvh - 230px) * 1000 / 560))', aspectRatio: `${W} / ${H}` }}
      >
        <ArenaBackdrop />
        {waves.current.map((w) => {
          const t = (clock - w.at) / 0.6;
          return (
            <span
              key={w.id}
              className="pointer-events-none absolute rounded-full border-4 border-marker"
              style={{
                left: `${(w.x / W) * 100}%`,
                top: `${(w.y / H) * 100}%`,
                width: `${(340 * t * 100) / W}%`,
                aspectRatio: '1',
                transform: 'translate(-50%, -50%)',
                opacity: 1 - t,
              }}
            />
          );
        })}
        {v.fighters.map((f) => (
          <FighterView key={f.id} f={f} you={f.id === v.meId} mode={v.mode} />
        ))}
        {settings.damageNumbers &&
          popups.current.map((p) => (
            <div
              key={p.id}
              className="anim-pop pointer-events-none absolute"
              style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, translate: '-50% -50%', width: p.big ? '16%' : '9%' }}
            >
              <Burst text={p.text} className="h-auto w-full" color={p.block ? 'var(--paper-3)' : p.big ? 'var(--crimson)' : 'var(--marker)'} />
            </div>
          ))}

        {v.intro > 0 && !over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/10">
            <div key={v.intro > 0.6 ? 'a' : 'b'} className="anim-rise font-display text-5xl text-marker title-stroke sm:text-7xl">
              {v.intro > 0.6 ? 'SẴN SÀNG…' : 'ĐÁNH!'}
            </div>
          </div>
        )}
        {me && me.koT > 0 && !over && (
          <div className="absolute inset-x-0 top-1/3 text-center">
            <div className="font-display text-3xl text-crimson title-stroke sm:text-5xl">BẠN BỊ HẠ!</div>
            <div className="mt-2 text-xl">Hồi sinh sau {Math.ceil(me.koT)}…</div>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30">
            <div className="anim-rise text-center">
              <div className="font-display text-6xl text-paper-3 title-stroke sm:text-8xl">KẾT THÚC</div>
              <div
                className={cn(
                  'mt-2 font-display text-2xl title-stroke',
                  over.winner === 'red' ? 'text-crimson' : over.winner === 'blue' ? 'text-cobalt' : 'text-marker',
                )}
              >
                {winnerLabel(over.mode, over.winner, nameOf)}
              </div>
            </div>
          </div>
        )}
        {online && netStatus !== 'open' && !over && (
          <div className="absolute inset-x-0 top-3 text-center">
            <span className="sk bg-crimson px-3 py-1 text-on-accent">Mất kết nối máy chủ…</span>
          </div>
        )}
        {showBoard && <Scoreboard fighters={v.fighters} meId={v.meId} mode={v.mode} />}
      </div>

      {/* ---------- bottom HUD: skills + touch pad ---------- */}
      <div className="flex w-full max-w-[1100px] flex-wrap items-end justify-center gap-3 sm:justify-between">
        {touch ? (
          <div className="flex gap-2">
            <TouchBtn label="Trái" onDown={press('left')} onUp={press('left', false)}>
              <ArrowBigLeft size={28} />
            </TouchBtn>
            <TouchBtn label="Phải" onDown={press('right')} onUp={press('right', false)}>
              <ArrowBigRight size={28} />
            </TouchBtn>
            <TouchBtn label="Nhảy" onDown={press('jump')} onUp={press('jump', false)}>
              <ArrowBigUp size={28} />
            </TouchBtn>
          </div>
        ) : (
          <div className="hidden text-ink-soft sm:block">
            <Kbd>A</Kbd> <Kbd>D</Kbd> di chuyển · <Kbd>W</Kbd> nhảy · giữ <Kbd>Tab</Kbd> xem điểm
          </div>
        )}
        {me && (
          <div className="flex gap-2 sm:gap-3">
            <SkillButton k="J" label="Đấm" cd={me.action === 'punch' ? 1 : me.cooldown / ATTACK.punch.cd} onDown={press('punch')} />
            <SkillButton k="K" label="Đá" cd={me.action === 'kick' ? 1 : me.cooldown / ATTACK.kick.cd} onDown={press('kick')} />
            <SkillButton k="L" label="Đỡ" active={me.action === 'block'} onDown={press('block')} onUp={press('block', false)} />
            <SkillButton k="Q" label="Tuyệt chiêu" charge={me.energy / 100} onDown={press('super')} ultimate />
          </div>
        )}
      </div>

      <Modal open={paused && !settingsOpen} onClose={() => setPaused(false)} title={online ? 'Menu' : 'Tạm dừng'}>
        <div className="grid gap-3">
          {online && <p className="text-ink-soft">Trận online vẫn tiếp tục trong lúc bạn mở menu.</p>}
          <Button variant="green" size="lg" onClick={() => setPaused(false)}>
            Tiếp tục
          </Button>
          <Button size="lg" onClick={() => setSettingsOpen(true)}>
            Cài đặt
          </Button>
          <Button variant="red" size="lg" onClick={leave}>
            Rời trận
          </Button>
          <div className="mt-2 border-t-2 border-dashed border-ink/30 pt-3">
            <ControlsList />
          </div>
        </div>
      </Modal>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arena pieces                                                        */
/* ------------------------------------------------------------------ */
function ArenaBackdrop() {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 h-full w-full" aria-hidden>
      <defs>
        <pattern id="hatch" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke="var(--ink)" strokeWidth="2" opacity="0.25" />
        </pattern>
      </defs>
      {Array.from({ length: 17 }).map((_, i) => (
        <line key={i} x1="0" x2={W} y1={i * 32 + 16} y2={i * 32 + 16} stroke="var(--rule)" strokeWidth="1.5" />
      ))}
      <circle cx="880" cy="80" r="38" fill="var(--marker)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M90 90 q 25 -30 55 -6 q 25 -24 50 2 q 18 22 -12 26 h -86 q -30 -6 -7 -22z" fill="var(--paper-3)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M520 70 q 18 -22 42 -5 q 18 -16 36 2 q 12 16 -10 19 h -62 q -22 -5 -6 -16z" fill="var(--paper-3)" stroke="var(--ink)" strokeWidth="3" />
      {PLATFORMS.map((p, i) => (
        <g key={i}>
          <path
            d={`M${p.x1 - 6} ${p.y} Q ${(p.x1 + p.x2) / 2} ${p.y - 5} ${p.x2 + 6} ${p.y} L ${p.x2} ${p.y + 22} Q ${(p.x1 + p.x2) / 2} ${p.y + 18} ${p.x1} ${p.y + 22} Z`}
            fill="var(--paper-2)"
            stroke="var(--ink)"
            strokeWidth="3.5"
            strokeLinejoin="round"
          />
          <rect x={p.x1 + 4} y={p.y + 4} width={p.x2 - p.x1 - 8} height="14" fill="url(#hatch)" />
        </g>
      ))}
      <path d={`M0 ${GROUND} Q ${W / 2} ${GROUND - 6} ${W} ${GROUND} L ${W} ${H} L 0 ${H} Z`} fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="4" />
      <rect x="0" y={GROUND + 6} width={W} height={H - GROUND} fill="url(#hatch)" />
    </svg>
  );
}

const teamColor = (mode: 'team' | 'ffa', team: string, color: string) =>
  mode === 'ffa' ? color : team === 'red' ? 'var(--crimson)' : 'var(--cobalt)';

function FighterView({ f, you, mode }: { f: Fighter; you: boolean; mode: 'team' | 'ffa' }) {
  const fw = 140 * FIG_K;
  const fh = 130 * FIG_K;
  return (
    <div
      className="absolute"
      style={{
        left: `${((f.x - fw / 2) / W) * 100}%`,
        top: `${((f.y - 125 * FIG_K) / H) * 100}%`,
        width: `${(fw / W) * 100}%`,
        height: `${(fh / H) * 100}%`,
        opacity: f.koT > 0 && f.koT < 1 ? 0.4 + 0.6 * Math.abs(Math.sin(f.koT * 12)) : 1,
      }}
    >
      {f.koT <= 0 && (
        <div className="absolute -top-[18%] left-1/2 w-[70%] -translate-x-1/2 text-center">
          <div className="truncate text-[clamp(9px,1.2vw,14px)] leading-none font-bold" style={{ color: teamColor(mode, f.team, f.color) }}>
            {you ? '▼ ' : ''}
            {f.name}
          </div>
          <div className="mt-0.5 h-[5px] overflow-hidden rounded-full border-[1.5px] border-ink bg-paper-2">
            <div className="h-full" style={{ width: `${f.hp}%`, background: hpColor(f.hp / 100) }} />
          </div>
        </div>
      )}
      <StickFigure
        pose={poseOf(f)}
        facing={f.facing}
        color={f.color}
        accessory={f.accessory}
        weapon={f.weapon}
        phase={(f.id.charCodeAt(f.id.length - 1) % 7) * 0.37}
        className="h-full w-full"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* HUD widgets                                                         */
/* ------------------------------------------------------------------ */
function PlayerCard({ f }: { f: Fighter }) {
  const full = f.energy >= 100;
  return (
    <div className="sk flex w-full items-center gap-2 bg-paper-3 p-2 shadow-ink-sm sm:max-w-xs">
      <div className="sk-round hidden h-12 w-12 shrink-0 place-items-center bg-paper sm:grid">
        <Head color={f.color} size={38} />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="truncate font-display text-xs">{f.name}</span>
          <span className="text-sm tabular-nums">{Math.ceil(f.hp)}</span>
        </div>
        <Bar value={f.hp} color={hpColor(f.hp / 100)} height="h-3.5" segments={10} label="" />
        <Bar value={f.energy} color={full ? 'var(--violet)' : 'var(--cobalt)'} height="h-2" segments={4} className={full ? 'animate-pulse' : ''} />
      </div>
    </div>
  );
}

function TeamScore({ team, value }: { team: 'red' | 'blue'; value: number }) {
  const red = team === 'red';
  return (
    <div
      className={cn(
        'flex min-w-14 flex-col items-center justify-center border-[2.5px] border-ink px-3 py-0.5 text-on-accent sm:min-w-20',
        red ? 'rounded-l-[12px] bg-crimson' : 'rounded-r-[12px] bg-cobalt',
      )}
    >
      <span className="font-display text-[10px] leading-none opacity-90">{red ? 'ĐỎ' : 'XANH'}</span>
      <span className="font-display text-2xl leading-none tabular-nums">{value}</span>
    </div>
  );
}

const feedColor = (team: string) => (team === 'red' ? 'text-crimson' : team === 'blue' ? 'text-cobalt' : '');

function KillFeed({ items }: { items: Feed[] }) {
  return (
    <ul className="hidden w-60 space-y-1 md:block" aria-live="polite">
      {items.map((k) => (
        <li key={k.id} className="anim-slide-in sk flex items-center justify-end gap-1.5 bg-paper-3/90 px-2 py-0.5 text-sm">
          <b className={cn('truncate', feedColor(k.kTeam))}>{k.killer}</b>
          <span aria-label="hạ gục">👊</span>
          <span className={cn('truncate line-through decoration-2', feedColor(k.vTeam))}>{k.victim}</span>
        </li>
      ))}
    </ul>
  );
}

function SkillButton({
  k,
  label,
  cd = 0,
  charge,
  active,
  ultimate,
  onDown,
  onUp,
}: {
  k: string;
  label: string;
  cd?: number;
  charge?: number;
  active?: boolean;
  ultimate?: boolean;
  onDown: () => void;
  onUp?: () => void;
}) {
  const ready = charge === undefined ? cd <= 0 : charge >= 1;
  return (
    <button
      onPointerDown={(e: RPointerEvent) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      aria-label={label}
      className={cn(
        'sk relative grid h-14 w-14 touch-none place-items-center overflow-hidden bg-paper-3 shadow-ink-sm transition-transform sm:h-[72px] sm:w-[72px]',
        active && 'translate-y-0.5 bg-cobalt text-on-accent',
        ultimate && ready && 'bg-violet text-on-accent anim-wobble',
      )}
    >
      {charge !== undefined && !ready && (
        <span className="absolute inset-x-0 bottom-0 bg-violet/40" style={{ height: `${charge * 100}%` }} aria-hidden />
      )}
      {cd > 0 && <span className="absolute inset-x-0 top-0 bg-ink/35" style={{ height: `${Math.min(1, cd) * 100}%` }} aria-hidden />}
      <span className="relative flex flex-col items-center leading-none">
        <span className="font-display text-xl">{k}</span>
        <span className="mt-1 max-w-full truncate px-0.5 text-[11px] sm:text-[12px]">{label}</span>
      </span>
    </button>
  );
}

function TouchBtn({ children, label, onDown, onUp }: { children: ReactNode; label: string; onDown: () => void; onUp: () => void }) {
  return (
    <button
      aria-label={label}
      className="sk grid h-14 w-14 touch-none place-items-center bg-paper-3 shadow-ink-sm active:translate-y-0.5 active:bg-marker sm:h-16 sm:w-16"
      onPointerDown={(e) => {
        e.preventDefault();
        onDown();
      }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >
      {children}
    </button>
  );
}

function Scoreboard({ fighters, meId, mode }: { fighters: Fighter[]; meId: string; mode: 'team' | 'ffa' }) {
  const groups: { key: string; label: string; cls: string; list: Fighter[] }[] =
    mode === 'team'
      ? [
          { key: 'red', label: 'ĐỘI ĐỎ', cls: 'text-crimson', list: fighters.filter((f) => f.team === 'red') },
          { key: 'blue', label: 'ĐỘI XANH', cls: 'text-cobalt', list: fighters.filter((f) => f.team === 'blue') },
        ]
      : [{ key: 'all', label: 'NGƯỜI CHƠI', cls: '', list: fighters }];
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink/30 p-4">
      <div className="sk shadow-ink-lg w-full max-w-xl bg-paper-3 p-4">
        <h2 className="mb-3 text-center font-display text-xl">Bảng điểm</h2>
        <div className={cn('grid gap-4', groups.length > 1 && 'sm:grid-cols-2')}>
          {groups.map((g) => (
            <table key={g.key} className="w-full">
              <thead>
                <tr className={cn('font-display text-xs', g.cls)}>
                  <th className="text-left">{g.label}</th>
                  <th className="w-10">K.O</th>
                  <th className="w-10">Gục</th>
                  <th className="w-12">ST</th>
                </tr>
              </thead>
              <tbody>
                {[...g.list]
                  .sort((a, b) => b.kos - a.kos)
                  .map((f) => (
                    <tr key={f.id} className={cn('border-t-2 border-dashed border-ink/20', f.id === meId && 'hl')}>
                      <td className="max-w-0 truncate py-0.5">
                        {f.name}
                        {f.bot && <span className="text-ink-soft"> (bot)</span>}
                      </td>
                      <td className="text-center tabular-nums">{f.kos}</td>
                      <td className="text-center tabular-nums">{f.falls}</td>
                      <td className="text-center tabular-nums">{Math.round(f.damage)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          ))}
        </div>
      </div>
    </div>
  );
}

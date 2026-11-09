import { useEffect, useMemo, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useLocation, useParams, useSearch } from 'wouter';
import { ArrowLeft, Maximize, Minimize, Pause, Wifi, Wind } from 'lucide-react';
import {
  DT,
  H,
  MAPS,
  MAP_IDS,
  MATCH_SEC,
  W,
  ATTACK,
  matchTime,
  nextGust,
  resolveMapChoice,
  type KoCause,
  type MapChoice,
  type MapId,
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
import { ActionCluster, MovePad, canFullscreen, detectTouch, toggleFullscreen, useButtonSize, useIsFullscreen, useViewport } from '@/components/TouchControls';
import { StickFigure, type Pose } from '@/components/StickFigure';
import { Bar, Burst, Button, Head, IconButton, Kbd, Modal, hpColor } from '@/components/ui';
import { BOTS } from '@/lib/mock';
import { setLastResult, useStore, type MatchResult, type Profile } from '@/lib/store';
import { cn, formatTime } from '@/lib/utils';
import { ArenaScene, MapPicker, mapLabel } from '@/lib/maps';
import { net, takeInput, useNet, type InputState, type MatchView } from '@/net/client';

const FIG_K = 0.85; // viewBox → world scale
const AR = W / H;

/** Measure an element's content box (used to fit the arena to any screen). */
function useBox() {
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const r = e!.contentRect;
      setBox((b) => (Math.abs(b.w - r.width) < 1 && Math.abs(b.h - r.height) < 1 ? b : { w: r.width, h: r.height }));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, box] as const;
}
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
  constructor(profile: Profile, map: MapId) {
    this.m = createMatch('team', [
      { id: 'me', name: profile.name, color: profile.color, accessory: profile.accessory, weapon: profile.weapon, team: 'red', bot: false },
      ...BOTS.slice(0, 5).map((b, i) => ({ ...b, id: `bot${i}`, team: i < 2 ? 'red' : 'blue', bot: true })),
    ], MATCH_SEC, map);
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
    return { mode: m.mode, map: m.map, t: matchTime(m.tick), meId: 'me', fighters: m.fighters, score: m.score, timeLeft: m.timeLeft, intro: m.intro };
  }
  result(): MatchResult {
    const m = this.m;
    return {
      mode: m.mode,
      map: m.map,
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

type Popup = { id: number; x: number; y: number; text: string; at: number; big: boolean; block: boolean; burn?: boolean };
type Feed = { id: number; killer: string; victim: string; kTeam: string; vTeam: string; how: KoCause; at: number };
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
  const search = useSearch();
  const q = new URLSearchParams(search).get('map');
  const offlineMap = (MAP_IDS as readonly string[]).includes(q ?? '') ? (q as MapId) : null;
  if (!online && !offlineMap) return <OfflineSetup />;
  return <Arena online={online} offlineMap={offlineMap ?? 'notebook'} key={offlineMap ?? 'online'} />;
}

/** Offline: pick an arena before fighting the bots. */
function OfflineSetup() {
  const [, nav] = useLocation();
  const [choice, setChoice] = useState<MapChoice>(() => {
    try {
      return (localStorage.getItem('qc.lastMap') as MapChoice | null) ?? 'notebook';
    } catch {
      return 'notebook';
    }
  });
  const start = () => {
    try {
      localStorage.setItem('qc.lastMap', choice);
    } catch {
      /* ignore */
    }
    nav(`/play?map=${resolveMapChoice(choice)}`);
  };
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <Button size="sm" onClick={() => nav('/lobby')} aria-label="Về sảnh">
          <ArrowLeft size={16} strokeWidth={3} />
        </Button>
        <div>
          <h1 className="font-display text-3xl">Chọn bản đồ</h1>
          <p className="text-lg text-ink-soft">Đấu đồng đội 3 đấu 3 với bot, không cần mạng.</p>
        </div>
        <Button variant="red" size="lg" className="ml-auto" onClick={start}>
          Vào trận · {mapLabel(choice)}
        </Button>
      </div>
      <MapPicker value={choice} onChange={setChoice} />
    </div>
  );
}

function Arena({ online, offlineMap }: { online: boolean; offlineMap: MapId }) {
  const [, nav] = useLocation();
  const params = useParams<{ id?: string }>();
  const { profile, settings } = useStore();

  const netMatch = useNet((s) => s.match);
  const netResult = useNet((s) => s.result);
  const netStatus = useNet((s) => s.status);
  const ping = useNet((s) => s.ping);

  const local = useMemo(() => (online ? null : new LocalSource(profile, offlineMap)), [online, offlineMap]); // eslint-disable-line react-hooks/exhaustive-deps
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
  const menuOpen = paused || settingsOpen;
  const menuRef = useRef(menuOpen);
  menuRef.current = menuOpen;
  const shakeRef = useRef(settings.shake);
  shakeRef.current = settings.shake;
  const vibrateRef = useRef(settings.vibrate);
  vibrateRef.current = settings.vibrate;

  const [isTouch] = useState(detectTouch);
  const touchMode = settings.touchControls === 'on' || (settings.touchControls === 'auto' && isTouch);
  const vp = useViewport();
  const landscape = vp.w > vp.h;
  const btn = useButtonSize(settings.touchSize);
  const [stageRef, box] = useBox();

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
        if (e.v === v.meId && !e.blocked) {
          if (shakeRef.current) setShakeKey((k) => k + 1);
          if (vibrateRef.current) navigator.vibrate?.(30);
        }
      } else if (e.k === 'burn') {
        popups.current.push({ id: uid.current++, x: e.x, y: e.y, at: clock, big: false, block: false, burn: true, text: 'XÈO!' });
      } else if (e.k === 'ko') {
        const a = e.a ? byId(e.a) : undefined;
        const b = byId(e.v);
        feed.current.unshift({ id: uid.current++, killer: a?.name ?? '', victim: b?.name ?? '?', kTeam: a?.team ?? '', vTeam: b?.team ?? '', how: e.how, at: clock });
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
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
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

  /* ---------------- arena (shared by both layouts) ---------------- */
  const renderArena = (size: { w: number; h: number }, hud?: ReactNode) => {
    const big = { fontSize: Math.max(26, size.w * 0.085) };
    const mid = { fontSize: Math.max(16, size.w * 0.04) };
    return (
      <div
        key={shakeKey}
        className={cn('sk shadow-ink-lg relative overflow-hidden bg-paper-3', shakeKey > 0 && 'anim-shake')}
        style={{ width: size.w, height: size.h }}
      >
        <ArenaScene mapId={v.map} t={v.t} className="absolute inset-0" />
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
              <Burst text={p.text} className="h-auto w-full" color={p.burn ? '#f2802e' : p.block ? 'var(--paper-3)' : p.big ? 'var(--crimson)' : 'var(--marker)'} />
            </div>
          ))}

        {hud}

        {v.intro > 0 && !over && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-ink/10">
            <div key={v.intro > 0.6 ? 'a' : 'b'} className="anim-rise font-display text-marker title-stroke" style={big}>
              {v.intro > 0.6 ? 'SẴN SÀNG…' : 'ĐÁNH!'}
            </div>
          </div>
        )}
        {me && me.koT > 0 && !over && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
            <div className="font-display text-crimson title-stroke" style={big}>
              BẠN BỊ HẠ!
            </div>
            <div className="mt-1" style={mid}>
              Hồi sinh sau {Math.ceil(me.koT)}…
            </div>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30">
            <div className="anim-rise text-center">
              <div className="font-display text-paper-3 title-stroke" style={{ fontSize: Math.max(32, size.w * 0.1) }}>
                KẾT THÚC
              </div>
              <div
                className={cn('mt-1 font-display title-stroke', over.winner === 'red' ? 'text-crimson' : over.winner === 'blue' ? 'text-cobalt' : 'text-marker')}
                style={mid}
              >
                {winnerLabel(over.mode, over.winner, nameOf)}
              </div>
            </div>
          </div>
        )}
        {online && netStatus !== 'open' && !over && (
          <div className="absolute inset-x-0 top-1/4 text-center">
            <span className="sk bg-crimson px-3 py-1 text-on-accent">Mất kết nối máy chủ…</span>
          </div>
        )}
        {showBoard && !touchMode && <Scoreboard fighters={v.fighters} meId={v.meId} mode={v.mode} />}
      </div>
    );
  };

  const menus = (
    <>
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
          {!touchMode && (
            <div className="mt-2 border-t-2 border-dashed border-ink/30 pt-3">
              <ControlsList />
            </div>
          )}
        </div>
      </Modal>
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );

  /* ================= touch layout (phones, tablets) ================= */
  if (touchMode) {
    const ctrlH = Math.round(btn * 2.55 + 20);
    // Put the controls under the arena when that costs at most ~18% of arena size; otherwise float them over it.
    const fullW = Math.min(box.w, box.h * AR);
    const below = Math.min(box.w, (box.h - ctrlH) * AR) >= fullW * 0.82;
    const arenaW = Math.max(0, below ? Math.min(box.w, (box.h - ctrlH) * AR) : Math.min(box.w, box.h * AR));
    const size = { w: arenaW, h: arenaW / AR };
    const arenaTop = below ? Math.max(0, (box.h - ctrlH - size.h) / 2) : (box.h - size.h) / 2;
    const hud = (
      <CompactHud
        v={v}
        me={me}
        online={online}
        netStatus={netStatus}
        ping={ping}
        feed={feed.current}
        showFeed={size.w >= 560}
        onPause={() => setPaused(true)}
        onBoard={() => setShowBoard((b) => !b)}
      />
    );
    return (
      <>
        <div className="game-shell flex flex-col bg-paper" onContextMenu={(e) => e.preventDefault()}>
          {!landscape && <div className="px-2 pt-2">{hud}</div>}
          <div ref={stageRef} className="relative min-h-0 flex-1">
            <div className="absolute left-1/2 -translate-x-1/2" style={{ top: arenaTop }}>
              {size.w > 0 && renderArena(size, landscape ? <div className="absolute inset-x-0 top-0 z-10 p-1.5">{hud}</div> : undefined)}
            </div>
            {below && !landscape && (
              <p className="absolute inset-x-0 text-center text-sm text-ink-soft" style={{ top: arenaTop + size.h + 6 }}>
                ↻ Xoay ngang để có sân đấu to hơn
              </p>
            )}
            {me && (
              <div
                className={cn('pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between px-3 pb-3', !below && 'opacity-90')}
                style={{ height: ctrlH }}
              >
                <MovePad input={input} s={btn} vibrate={settings.vibrate} className="pointer-events-auto" />
                <ActionCluster
                  input={input}
                  s={btn}
                  vibrate={settings.vibrate}
                  punchCd={me.action === 'punch' ? 1 : me.cooldown / ATTACK.punch.cd}
                  kickCd={me.action === 'kick' ? 1 : me.cooldown / ATTACK.kick.cd}
                  blocking={me.action === 'block'}
                  energy={me.energy / 100}
                  className="pointer-events-auto"
                />
              </div>
            )}
          </div>
        </div>
        {showBoard && (
          <div className="fixed inset-0 z-40 grid place-items-center bg-ink/30 p-3" onClick={() => setShowBoard(false)}>
            <Scoreboard fighters={v.fighters} meId={v.meId} mode={v.mode} inline />
          </div>
        )}
        {menus}
      </>
    );
  }

  /* ================= desktop layout (keyboard) ================= */
  const deskW = Math.max(0, Math.min(box.w, box.h * AR, 1100));
  return (
    <div className="flex h-dvh flex-col items-center gap-3 px-2 py-3 select-none">
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
            {MAPS[v.map].name} · {v.mode === 'team' ? `đội đầu tiên đạt ${winScore('team')} K.O thắng` : `ai đạt ${winScore('ffa')} K.O trước thắng`}
          </div>
          <WindAlert map={v.map} t={v.t} intro={v.intro} />
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

      {/* ---------- arena ---------- */}
      <div ref={stageRef} className="flex min-h-0 w-full max-w-[1100px] flex-1 items-center justify-center">
        {deskW > 0 && renderArena({ w: deskW, h: deskW / AR })}
      </div>

      {/* ---------- bottom HUD ---------- */}
      <div className="flex w-full max-w-[1100px] flex-wrap items-end justify-center gap-3 sm:justify-between">
        <div className="hidden text-ink-soft sm:block">
          <Kbd>A</Kbd> <Kbd>D</Kbd> di chuyển · <Kbd>W</Kbd> nhảy · giữ <Kbd>Tab</Kbd> xem điểm
        </div>
        {me && (
          <div className="flex gap-2 sm:gap-3">
            <SkillButton k="J" label="Đấm" cd={me.action === 'punch' ? 1 : me.cooldown / ATTACK.punch.cd} onDown={press('punch')} />
            <SkillButton k="K" label="Đá" cd={me.action === 'kick' ? 1 : me.cooldown / ATTACK.kick.cd} onDown={press('kick')} />
            <SkillButton k="L" label="Đỡ" active={me.action === 'block'} onDown={press('block')} onUp={press('block', false)} />
            <SkillButton k="Q" label="Tuyệt chiêu" charge={me.energy / 100} onDown={press('super')} ultimate />
          </div>
        )}
      </div>
      {menus}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Arena pieces                                                        */
/* ------------------------------------------------------------------ */
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

const KO_LABEL: Record<KoCause, string> = { hit: 'hạ gục', fall: 'đẩy xuống vực', lava: 'đẩy vào dung nham' };

/** Rooftop gusts: warn a few seconds ahead, then show the direction while blowing. */
function WindAlert({ map, t, intro }: { map: MapId; t: number; intro: number }) {
  const g = nextGust(MAPS[map], t);
  if (!g || intro > 0 || g.inSec > 3) return null;
  const arrow = g.dir > 0 ? '→' : '←';
  return (
    <div className={cn('sk inline-flex items-center gap-1.5 px-2 py-0.5 text-sm', g.inSec === 0 ? 'bg-cobalt text-on-accent anim-wobble' : 'bg-marker text-on-marker')} role="status">
      <Wind size={15} strokeWidth={3} />
      {g.inSec === 0 ? `Gió đang thổi ${arrow}` : `Gió ${arrow} sau ${Math.ceil(g.inSec)}s`}
    </div>
  );
}

function KillFeed({ items }: { items: Feed[] }) {
  return (
    <ul className="hidden w-60 space-y-1 md:block" aria-live="polite">
      {items.map((k) => (
        <li key={k.id} className="anim-slide-in sk flex items-center justify-end gap-1.5 bg-paper-3/90 px-2 py-0.5 text-sm">
          {k.killer && <b className={cn('truncate', feedColor(k.kTeam))}>{k.killer}</b>}
          <span aria-label={KO_LABEL[k.how]} title={KO_LABEL[k.how]}>
            {k.how === 'fall' ? '🕳️' : k.how === 'lava' ? '🔥' : '👊'}
          </span>
          <span className={cn('truncate line-through decoration-2', feedColor(k.vTeam))}>{k.victim}</span>
          {!k.killer && <span className="text-ink-soft">{k.how === 'fall' ? 'rơi vực' : 'bị nướng'}</span>}
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

function Scoreboard({ fighters, meId, mode, inline = false }: { fighters: Fighter[]; meId: string; mode: 'team' | 'ffa'; inline?: boolean }) {
  const groups: { key: string; label: string; cls: string; list: Fighter[] }[] =
    mode === 'team'
      ? [
          { key: 'red', label: 'ĐỘI ĐỎ', cls: 'text-crimson', list: fighters.filter((f) => f.team === 'red') },
          { key: 'blue', label: 'ĐỘI XANH', cls: 'text-cobalt', list: fighters.filter((f) => f.team === 'blue') },
        ]
      : [{ key: 'all', label: 'NGƯỜI CHƠI', cls: '', list: fighters }];
  const card = (
      <div className="sk shadow-ink-lg scroll-sk max-h-[85dvh] w-full max-w-xl overflow-y-auto bg-paper-3 p-3 sm:p-4">
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
  );
  if (inline) return card;
  return <div className="absolute inset-0 grid place-items-center bg-ink/30 p-4">{card}</div>;
}

/* ------------------------------------------------------------------ */
/* Compact HUD for phones                                              */
/* ------------------------------------------------------------------ */
function CompactHud({
  v,
  me,
  online,
  netStatus,
  ping,
  feed,
  showFeed,
  onPause,
  onBoard,
}: {
  v: MatchView;
  me: Fighter | undefined;
  online: boolean;
  netStatus: string;
  ping: number | null;
  feed: Feed[];
  showFeed: boolean;
  onPause: () => void;
  onBoard: () => void;
}) {
  const fs = useIsFullscreen();
  const lead = v.mode === 'ffa' ? [...v.fighters].sort((a, b) => b.kos - a.kos)[0] : undefined;
  return (
    <div className="flex items-start justify-between gap-1.5 text-ink">
      {/* you */}
      {me ? (
        <div className="sk min-w-0 bg-paper-3/90 px-2 py-1 shadow-ink-sm" style={{ width: 'clamp(118px, 30vw, 230px)' }}>
          <div className="flex items-baseline justify-between gap-1 leading-none">
            <span className="truncate font-display text-[10px]">{me.name}</span>
            <span className="text-xs tabular-nums">{Math.ceil(me.hp)}</span>
          </div>
          <Bar value={me.hp} color={hpColor(me.hp / 100)} height="h-2.5" segments={5} className="mt-0.5" />
          <Bar value={me.energy} color={me.energy >= 100 ? 'var(--violet)' : 'var(--cobalt)'} height="h-1.5" className="mt-0.5" />
        </div>
      ) : (
        <span />
      )}

      {/* score + clock (tap for scoreboard) */}
      <div className="flex shrink-0 flex-col items-center gap-1">
        <button className="flex items-stretch" onClick={onBoard} aria-label="Xem bảng điểm">
          {v.mode === 'team' && (
            <span className="grid min-w-9 place-items-center rounded-l-[10px] border-[2.5px] border-ink bg-crimson px-1.5 font-display text-lg leading-none text-on-accent tabular-nums">
              {v.score.red ?? 0}
            </span>
          )}
          <span className={cn('sk z-10 -mx-0.5 bg-paper-3 px-2 py-0.5 font-display text-lg tabular-nums', v.timeLeft < 30 && 'text-crimson')}>
            {formatTime(v.timeLeft)}
          </span>
          {v.mode === 'team' && (
            <span className="grid min-w-9 place-items-center rounded-r-[10px] border-[2.5px] border-ink bg-cobalt px-1.5 font-display text-lg leading-none text-on-accent tabular-nums">
              {v.score.blue ?? 0}
            </span>
          )}
        </button>
        {lead && (
          <span className="sk bg-paper-3/90 px-1.5 text-[11px] leading-tight">
            Dẫn đầu: <b>{lead.name}</b> ({lead.kos})
          </span>
        )}
        <WindAlert map={v.map} t={v.t} intro={v.intro} />
      </div>

      {/* actions */}
      <div className="flex min-w-0 flex-col items-end gap-1" style={{ width: 'clamp(118px, 30vw, 230px)' }}>
        <div className="flex items-center gap-1.5">
          {online && (
            <span className={cn('sk inline-flex items-center gap-0.5 bg-paper-3/90 px-1.5 py-0.5 text-[11px] tabular-nums', netStatus !== 'open' && 'bg-crimson text-on-accent')}>
              <Wifi size={11} strokeWidth={3} />
              {netStatus === 'open' ? (ping ?? '–') : '!'}
            </span>
          )}
          {canFullscreen() && (
            <button className="btn h-8 w-8 bg-paper-3 p-0" onClick={toggleFullscreen} aria-label={fs ? 'Thoát toàn màn hình' : 'Toàn màn hình'}>
              {fs ? <Minimize size={15} strokeWidth={3} /> : <Maximize size={15} strokeWidth={3} />}
            </button>
          )}
          <button className="btn h-8 w-8 bg-paper-3 p-0" onClick={onPause} aria-label="Menu">
            <Pause size={15} strokeWidth={3} />
          </button>
        </div>
        {showFeed &&
          feed.slice(0, 2).map((k) => (
            <span key={k.id} className="anim-slide-in sk max-w-full truncate bg-paper-3/85 px-1.5 text-[11px] leading-tight">
              {k.killer && <b className={feedColor(k.kTeam)}>{k.killer} </b>}
              {k.how === 'fall' ? '🕳️' : k.how === 'lava' ? '🔥' : '👊'} <s className={feedColor(k.vTeam)}>{k.victim}</s>
            </span>
          ))}
      </div>
    </div>
  );
}

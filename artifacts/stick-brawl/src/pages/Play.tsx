import { useCallback, useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { useLocation } from 'wouter';
import { ArrowBigLeft, ArrowBigRight, ArrowBigUp, Pause } from 'lucide-react';

import { ControlsList, SettingsModal } from '@/components/Layout';
import { StickFigure, type Accessory, type Pose, type Weapon } from '@/components/StickFigure';
import { Bar, Burst, Button, Head, IconButton, Kbd, Modal, hpColor } from '@/components/ui';
import { BOTS } from '@/lib/mock';
import { setLastResult, useStore } from '@/lib/store';
import { cn, formatTime } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Local demo simulation — stands in for the future netcode            */
/* ------------------------------------------------------------------ */
const W = 1000;
const H = 560;
const GROUND = 470;
const PLATFORMS = [
  { x1: 140, x2: 360, y: 340 },
  { x1: 640, x2: 860, y: 340 },
  { x1: 400, x2: 600, y: 215 },
];
const GRAVITY = 1700;
const SPEED = 260;
const JUMP = 720;
const MATCH_SEC = 180;
const WIN_KOS = 10;
const FIG_K = 0.85; // viewBox → world scale

type Team = 'red' | 'blue';
type Action = 'none' | 'punch' | 'kick' | 'block' | 'super';

type Fighter = {
  id: number;
  name: string;
  team: Team;
  color: string;
  accessory: Accessory;
  weapon: Weapon;
  you: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  onGround: boolean;
  hp: number;
  energy: number;
  action: Action;
  actionT: number;
  hitDone: boolean;
  hurtT: number;
  koT: number;
  kos: number;
  falls: number;
  damage: number;
  aiT: number;
  aiMove: number;
  cooldown: number;
};

const ATTACK = {
  punch: { dur: 0.3, hitAt: 0.1, range: 64, dmg: 7, knock: 180, cd: 0.32 },
  kick: { dur: 0.45, hitAt: 0.18, range: 80, dmg: 11, knock: 280, cd: 0.5 },
  super: { dur: 0.6, hitAt: 0.22, range: 170, dmg: 26, knock: 620, cd: 0.6 },
} as const;

const WEAPON_MOD: Record<Weapon, { dmg: number; range: number; speed: number }> = {
  none: { dmg: 1, range: 0, speed: 1 },
  sword: { dmg: 1.25, range: 14, speed: 1 },
  staff: { dmg: 1.05, range: 30, speed: 1.1 },
  hammer: { dmg: 1.5, range: 10, speed: 1.3 },
};

const HIT_WORDS = ['BỐP!', 'HỰ!', 'BỤP!', 'RẮC!', 'ỐI!'];

type Popup = { id: number; x: number; y: number; text: string; at: number; big?: boolean; block?: boolean };
type Feed = { id: number; killer: string; victim: string; kTeam: Team; vTeam: Team; at: number };

const spawnX = (team: Team, i: number) => (team === 'red' ? 90 + i * 60 : W - 90 - i * 60);

function makeFighters(profile: { name: string; color: string; accessory: Accessory; weapon: Weapon }): Fighter[] {
  const roster: { name: string; color: string; accessory: Accessory; weapon: Weapon; team: Team; you?: boolean }[] = [
    { ...profile, team: 'red', you: true },
    { ...BOTS[0], team: 'red' },
    { ...BOTS[1], team: 'red' },
    { ...BOTS[2], team: 'blue' },
    { ...BOTS[3], team: 'blue' },
    { ...BOTS[4], team: 'blue' },
  ];
  const idx = { red: 0, blue: 0 };
  return roster.map((r, id) => {
    const i = idx[r.team]++;
    return {
      id,
      ...r,
      you: !!r.you,
      x: spawnX(r.team, i),
      y: GROUND,
      vx: 0,
      vy: 0,
      facing: r.team === 'red' ? 1 : -1,
      onGround: true,
      hp: 100,
      energy: r.you ? 60 : 0,
      action: 'none',
      actionT: 0,
      hitDone: false,
      hurtT: 0,
      koT: 0,
      kos: 0,
      falls: 0,
      damage: 0,
      aiT: Math.random(),
      aiMove: 0,
      cooldown: 0,
    };
  });
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

type Input = { left: boolean; right: boolean; jump: boolean; punch: boolean; kick: boolean; block: boolean; super: boolean };
const emptyInput = (): Input => ({ left: false, right: false, jump: false, punch: false, kick: false, block: false, super: false });

export default function Play() {
  const [, nav] = useLocation();
  const { profile, settings } = useStore();

  const fighters = useRef<Fighter[]>(makeFighters(profile));
  const input = useRef<Input>(emptyInput());
  const popups = useRef<Popup[]>([]);
  const feed = useRef<Feed[]>([]);
  const shockwaves = useRef<{ id: number; x: number; y: number; at: number }[]>([]);
  const score = useRef({ red: 0, blue: 0 });
  const timeLeft = useRef(MATCH_SEC);
  const intro = useRef(1.6);
  const ended = useRef(false);
  const uid = useRef(1);
  const clock = useRef(0);

  const [, setFrame] = useState(0);
  const [paused, setPaused] = useState(false);
  const [showBoard, setShowBoard] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [over, setOver] = useState<null | Team | 'draw'>(null);
  const [touch] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches);
  const pausedRef = useRef(false);
  pausedRef.current = paused || settingsOpen;

  const finish = useCallback(() => {
    if (ended.current) return;
    ended.current = true;
    const s = score.current;
    const winner: Team | 'draw' = s.red === s.blue ? 'draw' : s.red > s.blue ? 'red' : 'blue';
    setOver(winner);
    setLastResult({
      winner,
      score: { ...s },
      durationSec: Math.round(MATCH_SEC - timeLeft.current),
      players: fighters.current.map((f) => ({
        name: f.name,
        team: f.team,
        color: f.color,
        accessory: f.accessory,
        weapon: f.weapon,
        kos: f.kos,
        falls: f.falls,
        damage: Math.round(f.damage),
        you: f.you,
      })),
    });
    setTimeout(() => nav('/results'), 2200);
  }, [nav]);

  /* ---------------- simulation step ---------------- */
  const step = useCallback(
    (dt: number) => {
      clock.current += dt;
      const fs = fighters.current;
      if (intro.current > 0) {
        intro.current -= dt;
        return;
      }
      if (ended.current) return;

      timeLeft.current -= dt;
      if (timeLeft.current <= 0) {
        timeLeft.current = 0;
        finish();
      }

      const startAction = (f: Fighter, a: Exclude<Action, 'none' | 'block'>) => {
        if (f.action !== 'none' && f.action !== 'block') return;
        if (f.cooldown > 0 || f.hurtT > 0) return;
        if (a === 'super') {
          if (f.energy < 100) return;
          f.energy = 0;
          shockwaves.current.push({ id: uid.current++, x: f.x, y: f.y - 45, at: clock.current });
        }
        f.action = a;
        f.actionT = 0;
        f.hitDone = false;
      };

      for (const f of fs) {
        f.cooldown = Math.max(0, f.cooldown - dt);
        f.hurtT = Math.max(0, f.hurtT - dt);

        if (f.koT > 0) {
          f.koT -= dt;
          f.vx *= 0.9;
          if (f.koT <= 0) {
            const mates = fs.filter((m) => m.team === f.team);
            Object.assign(f, {
              hp: 100,
              x: spawnX(f.team, mates.indexOf(f)),
              y: 0,
              vy: 0,
              vx: 0,
              action: 'none',
              hurtT: 0,
              onGround: false,
            });
          }
        } else {
          /* ----- intent: player input or AI ----- */
          let move = 0;
          let wantJump = false;
          let wantBlock = false;
          if (f.you) {
            const i = input.current;
            move = (i.right ? 1 : 0) - (i.left ? 1 : 0);
            wantJump = i.jump;
            wantBlock = i.block;
            if (i.punch) startAction(f, 'punch');
            if (i.kick) startAction(f, 'kick');
            if (i.super) startAction(f, 'super');
            i.punch = i.kick = i.super = false;
          } else {
            const foes = fs.filter((o) => o.team !== f.team && o.koT <= 0);
            const target = foes.sort((a, b) => Math.abs(a.x - f.x) + Math.abs(a.y - f.y) - (Math.abs(b.x - f.x) + Math.abs(b.y - f.y)))[0];
            f.aiT -= dt;
            if (target) {
              const dx = target.x - f.x;
              const dy = target.y - f.y;
              if (Math.abs(dx) > 55) move = Math.sign(dx);
              else f.facing = dx >= 0 ? 1 : -1;
              if (f.aiT <= 0) {
                f.aiT = 0.25 + Math.random() * 0.45;
                f.aiMove = Math.random() < 0.15 ? -Math.sign(dx) : 0;
                if (dy < -60 && f.onGround && Math.random() < 0.6) wantJump = true;
                if (Math.abs(dx) < 85 && Math.abs(dy) < 50) {
                  const r = Math.random();
                  if (f.energy >= 100 && r < 0.4) startAction(f, 'super');
                  else if (target.action !== 'none' && target.action !== 'block' && r < 0.3) wantBlock = true;
                  else if (r < 0.65) startAction(f, 'punch');
                  else startAction(f, 'kick');
                }
              }
              if (f.aiMove) move = f.aiMove;
              if (target.action !== 'none' && target.action !== 'block' && Math.abs(dx) < 90 && Math.random() < 0.02) wantBlock = true;
            }
          }

          if (wantBlock && f.action === 'none' && f.onGround) f.action = 'block';
          if (!wantBlock && f.action === 'block' && !f.you) {
            // AI holds block for a moment
            if (Math.random() < 0.05) f.action = 'none';
          } else if (!wantBlock && f.action === 'block') f.action = 'none';

          const busy = f.hurtT > 0 || (f.action !== 'none' && f.action !== 'block');
          const speed = f.action === 'block' ? SPEED * 0.25 : SPEED;
          if (!busy) {
            const targetVx = move * speed;
            f.vx += (targetVx - f.vx) * Math.min(1, dt * 14);
            if (move) f.facing = move > 0 ? 1 : -1;
            if (wantJump && f.onGround) {
              f.vy = -JUMP;
              f.onGround = false;
              if (f.action === 'block') f.action = 'none';
            }
          } else {
            f.vx *= Math.pow(0.02, dt);
          }

          /* ----- attacks ----- */
          if (f.action === 'punch' || f.action === 'kick' || f.action === 'super') {
            const spec = ATTACK[f.action];
            const mod = WEAPON_MOD[f.weapon];
            f.actionT += dt;
            if (!f.hitDone && f.actionT >= spec.hitAt * mod.speed) {
              f.hitDone = true;
              for (const o of fs) {
                if (o.team === f.team || o.koT > 0) continue;
                const dx = o.x - f.x;
                const inFront = f.action === 'super' || Math.sign(dx) === f.facing || Math.abs(dx) < 8;
                if (!inFront || Math.abs(dx) > spec.range + mod.range || Math.abs(o.y - f.y) > 60) continue;
                const blocked = o.action === 'block' && o.facing === -Math.sign(dx || f.facing) && f.action !== 'super';
                const dmg = spec.dmg * mod.dmg * (blocked ? 0.2 : 1) * (0.9 + Math.random() * 0.2);
                o.hp -= dmg;
                f.damage += dmg;
                f.energy = Math.min(100, f.energy + dmg * 1.6);
                o.energy = Math.min(100, o.energy + dmg * 0.6);
                const dir = Math.sign(dx) || f.facing;
                if (!blocked) {
                  o.hurtT = 0.28;
                  o.action = 'none';
                  o.vx = dir * spec.knock;
                  o.vy = f.action === 'super' ? -420 : -160;
                  o.onGround = false;
                } else {
                  o.vx = dir * 90;
                }
                popups.current.push({
                  id: uid.current++,
                  x: o.x,
                  y: o.y - 110,
                  text: blocked ? 'CHẶN!' : f.action === 'super' ? 'SIÊU CẤP!' : HIT_WORDS[Math.floor(Math.random() * HIT_WORDS.length)],
                  at: clock.current,
                  big: f.action === 'super',
                  block: blocked,
                });
                if (o.you && !blocked && settings.shake) setShakeKey((k) => k + 1);
                if (o.hp <= 0) {
                  o.hp = 0;
                  o.koT = 3;
                  o.falls++;
                  f.kos++;
                  score.current[f.team]++;
                  feed.current.unshift({ id: uid.current++, killer: f.name, victim: o.name, kTeam: f.team, vTeam: o.team, at: clock.current });
                  feed.current = feed.current.slice(0, 5);
                  if (score.current[f.team] >= WIN_KOS) finish();
                }
              }
            }
            if (f.actionT >= spec.dur * mod.speed) {
              f.action = 'none';
              f.cooldown = spec.cd;
            }
          }
        }

        /* ----- physics ----- */
        const prevY = f.y;
        f.vy += GRAVITY * dt;
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.onGround = false;
        if (f.y >= GROUND) {
          f.y = GROUND;
          f.vy = 0;
          f.onGround = true;
        } else if (f.vy > 0) {
          for (const p of PLATFORMS) {
            if (prevY <= p.y && f.y >= p.y && f.x >= p.x1 && f.x <= p.x2) {
              f.y = p.y;
              f.vy = 0;
              f.onGround = true;
            }
          }
        }
        if (f.x < 30) {
          f.x = 30;
          f.vx = Math.abs(f.vx) * 0.3;
        }
        if (f.x > W - 30) {
          f.x = W - 30;
          f.vx = -Math.abs(f.vx) * 0.3;
        }
      }

      popups.current = popups.current.filter((p) => clock.current - p.at < 0.9).slice(-12);
      shockwaves.current = shockwaves.current.filter((s) => clock.current - s.at < 0.6);
    },
    [finish, settings.shake],
  );

  /* ---------------- main loop ---------------- */
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      if (!pausedRef.current) step(dt);
      setFrame((n) => (n + 1) % 1_000_000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [step]);

  /* ---------------- keyboard ---------------- */
  useEffect(() => {
    const map: Record<string, keyof Input> = {
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
      const k = map[e.code];
      if (!k) return;
      e.preventDefault();
      if (e.repeat && (k === 'punch' || k === 'kick' || k === 'super')) return;
      input.current[k] = true;
    };
    const up = (e: KeyboardEvent) => {
      if (e.code === 'Tab') setShowBoard(false);
      const k = map[e.code];
      if (k && k !== 'punch' && k !== 'kick' && k !== 'super') input.current[k] = false;
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

  const press = (k: keyof Input, v = true) => () => {
    input.current[k] = v;
  };

  const fs = fighters.current;
  const me = fs.find((f) => f.you)!;
  const s = score.current;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-2 py-3 select-none">
      {/* ---------- top HUD ---------- */}
      <div className="flex w-full max-w-[1100px] flex-wrap items-start justify-between gap-2 sm:flex-nowrap sm:gap-3">
        <div className="order-2 w-full sm:order-1 sm:w-auto sm:flex-1">
          <PlayerCard f={me} />
        </div>
        <div className="order-1 flex flex-col items-center gap-1 sm:order-2">
          <div className="flex items-stretch">
            <TeamScore team="red" value={s.red} />
            <div className="sk z-10 -mx-1 bg-paper-3 px-2.5 py-1 text-center shadow-ink-sm sm:px-4">
              <div className={cn('font-display text-2xl tabular-nums', timeLeft.current < 30 && 'text-crimson')}>{formatTime(timeLeft.current)}</div>
            </div>
            <TeamScore team="blue" value={s.blue} />
          </div>
          <div className="hidden text-sm text-ink-soft sm:block">Đầu tiên đạt {WIN_KOS} K.O thắng</div>
        </div>
        <div className="order-1 flex items-start justify-end gap-2 sm:order-3 sm:flex-1">
          <KillFeed items={feed.current} now={clock.current} />
          <IconButton aria-label="Tạm dừng" onClick={() => setPaused(true)}>
            <Pause size={18} strokeWidth={3} />
          </IconButton>
        </div>
      </div>

      {touch && (
        <p className="text-center text-sm text-ink-soft landscape:hidden">↻ Xoay ngang điện thoại để chơi thoải mái hơn</p>
      )}

      {/* ---------- arena ---------- */}
      <div
        key={shakeKey}
        className={cn('sk shadow-ink-lg relative overflow-hidden bg-paper-3', shakeKey > 0 && 'anim-shake')}
        style={{ width: 'min(100%, 1100px, calc((100dvh - 230px) * 1000 / 560))', aspectRatio: `${W} / ${H}` }}
      >
        <ArenaBackdrop />
        {shockwaves.current.map((w) => {
          const t = (clock.current - w.at) / 0.6;
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
        {fs.map((f) => (
          <FighterView key={f.id} f={f} />
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

        {intro.current > 0 && (
          <div className="absolute inset-0 grid place-items-center bg-ink/10">
            <div key={intro.current > 0.6 ? 'a' : 'b'} className="anim-rise font-display text-5xl text-marker title-stroke sm:text-7xl">
              {intro.current > 0.6 ? 'SẴN SÀNG…' : 'ĐÁNH!'}
            </div>
          </div>
        )}
        {me.koT > 0 && !over && (
          <div className="absolute inset-x-0 top-1/3 text-center">
            <div className="font-display text-3xl text-crimson title-stroke sm:text-5xl">BẠN BỊ HẠ!</div>
            <div className="mt-2 text-xl">Hồi sinh sau {Math.ceil(me.koT)}…</div>
          </div>
        )}
        {over && (
          <div className="absolute inset-0 grid place-items-center bg-ink/30">
            <div className="anim-rise text-center">
              <div className="font-display text-6xl text-paper-3 title-stroke sm:text-8xl">KẾT THÚC</div>
              <div className={cn('mt-2 font-display text-2xl title-stroke', over === 'red' ? 'text-crimson' : over === 'blue' ? 'text-cobalt' : 'text-marker')}>
                {over === 'draw' ? 'Hoà!' : over === 'red' ? 'Đội Đỏ thắng!' : 'Đội Xanh thắng!'}
              </div>
            </div>
          </div>
        )}
        {showBoard && <Scoreboard fighters={fs} />}
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
        <div className="flex gap-2 sm:gap-3">
          <SkillButton k="J" label="Đấm" cd={me.action === 'punch' ? 1 : me.cooldown / ATTACK.punch.cd} onDown={press('punch')} />
          <SkillButton k="K" label="Đá" cd={me.action === 'kick' ? 1 : me.cooldown / ATTACK.kick.cd} onDown={press('kick')} />
          <SkillButton k="L" label="Đỡ" active={me.action === 'block'} onDown={press('block')} onUp={press('block', false)} />
          <SkillButton k="Q" label="Tuyệt chiêu" charge={me.energy / 100} onDown={press('super')} ultimate />
        </div>
      </div>

      <Modal open={paused && !settingsOpen} onClose={() => setPaused(false)} title="Tạm dừng">
        <div className="grid gap-3">
          <Button variant="green" size="lg" onClick={() => setPaused(false)}>
            Tiếp tục
          </Button>
          <Button size="lg" onClick={() => setSettingsOpen(true)}>
            Cài đặt
          </Button>
          <Button variant="red" size="lg" onClick={() => nav('/lobby')}>
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

function FighterView({ f }: { f: Fighter }) {
  const fw = 140 * FIG_K;
  const fh = 130 * FIG_K;
  const teamColor = f.team === 'red' ? 'var(--crimson)' : 'var(--cobalt)';
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
          <div className="truncate text-[clamp(9px,1.2vw,14px)] leading-none font-bold" style={{ color: teamColor }}>
            {f.you ? '▼ ' : ''}
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
        phase={f.id * 0.37}
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

function TeamScore({ team, value }: { team: Team; value: number }) {
  const red = team === 'red';
  return (
    <div
      className={cn(
        'flex min-w-14 flex-col sm:min-w-20 items-center justify-center border-[2.5px] border-ink px-3 py-0.5 text-on-accent',
        red ? 'rounded-l-[12px] bg-crimson' : 'rounded-r-[12px] bg-cobalt',
      )}
    >
      <span className="font-display text-[10px] leading-none opacity-90">{red ? 'ĐỎ' : 'XANH'}</span>
      <span className="font-display text-2xl leading-none tabular-nums">{value}</span>
    </div>
  );
}

function KillFeed({ items, now }: { items: Feed[]; now: number }) {
  return (
    <ul className="hidden w-60 space-y-1 md:block" aria-live="polite">
      {items
        .filter((k) => now - k.at < 6)
        .map((k) => (
          <li key={k.id} className="anim-slide-in sk flex items-center justify-end gap-1.5 bg-paper-3/90 px-2 py-0.5 text-sm">
            <b className={k.kTeam === 'red' ? 'text-crimson' : 'text-cobalt'}>{k.killer}</b>
            <span aria-label="hạ gục">👊</span>
            <span className={cn('line-through decoration-2', k.vTeam === 'red' ? 'text-crimson' : 'text-cobalt')}>{k.victim}</span>
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
  const handlers = {
    onPointerDown: (e: RPointerEvent) => {
      e.preventDefault();
      onDown();
    },
    onPointerUp: onUp,
    onPointerLeave: onUp,
  };
  return (
    <button
      {...handlers}
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
      className="sk grid h-14 w-14 touch-none sm:h-16 sm:w-16 place-items-center bg-paper-3 shadow-ink-sm active:translate-y-0.5 active:bg-marker"
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

function Scoreboard({ fighters }: { fighters: Fighter[] }) {
  return (
    <div className="absolute inset-0 grid place-items-center bg-ink/30 p-4">
      <div className="sk shadow-ink-lg w-full max-w-xl bg-paper-3 p-4">
        <h2 className="mb-3 text-center font-display text-xl">Bảng điểm</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {(['red', 'blue'] as Team[]).map((t) => (
            <table key={t} className="w-full">
              <thead>
                <tr className={cn('font-display text-xs', t === 'red' ? 'text-crimson' : 'text-cobalt')}>
                  <th className="text-left">{t === 'red' ? 'ĐỘI ĐỎ' : 'ĐỘI XANH'}</th>
                  <th className="w-10">K.O</th>
                  <th className="w-10">Gục</th>
                  <th className="w-12">ST</th>
                </tr>
              </thead>
              <tbody>
                {fighters
                  .filter((f) => f.team === t)
                  .sort((a, b) => b.kos - a.kos)
                  .map((f) => (
                    <tr key={f.id} className={cn('border-t-2 border-dashed border-ink/20', f.you && 'hl')}>
                      <td className="max-w-0 truncate py-0.5">{f.name}</td>
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

/**
 * On-screen controls for phones and tablets.
 *
 * - MovePad: drag left/right anywhere on the pad, swipe up to jump.
 *   Uses pointer capture, so the thumb can slide without "losing" the pad.
 * - ActionCluster: thumb-sized buttons laid out like a console face, every
 *   button tracks its own pointer so several can be held at once.
 */
import { useEffect, useRef, useState, type PointerEvent as RPointerEvent, type ReactNode } from 'react';
import { ArrowBigUp, Shield } from 'lucide-react';

import type { InputState } from '@/net/client';
import { cn } from '@/lib/utils';

export type TouchSize = 'sm' | 'md' | 'lg';

const buzz = (on: boolean, ms = 8) => {
  if (on) navigator.vibrate?.(ms);
};

/** Live viewport size (handles rotation, browser bars and split screen). */
export function useViewport() {
  const read = () => ({
    w: typeof window === 'undefined' ? 1024 : window.innerWidth,
    h: typeof window === 'undefined' ? 768 : window.innerHeight,
  });
  const [vp, setVp] = useState(read);
  useEffect(() => {
    const on = () => setVp(read());
    window.addEventListener('resize', on);
    window.addEventListener('orientationchange', on);
    window.visualViewport?.addEventListener('resize', on);
    return () => {
      window.removeEventListener('resize', on);
      window.removeEventListener('orientationchange', on);
      window.visualViewport?.removeEventListener('resize', on);
    };
  }, []);
  return vp;
}

/** Button size in px, scaled to the short side of the screen. */
export function useButtonSize(size: TouchSize) {
  const { w, h } = useViewport();
  const scale = size === 'sm' ? 0.82 : size === 'lg' ? 1.2 : 1;
  return Math.round(Math.min(84, Math.max(46, Math.min(w, h) * 0.15)) * scale);
}

/** Touch-first device: no fine pointer, or touch points but no hover. */
export function detectTouch() {
  if (typeof window === 'undefined') return false;
  const mm = window.matchMedia?.bind(window);
  return !!(mm?.('(pointer: coarse)').matches || (navigator.maxTouchPoints > 0 && !mm?.('(hover: hover)').matches));
}

/* ------------------------------------------------------------------ */
/* Move pad                                                            */
/* ------------------------------------------------------------------ */
export function MovePad({ input, s, vibrate, className }: { input: React.RefObject<InputState>; s: number; vibrate: boolean; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const pid = useRef<number | null>(null);
  const [knob, setKnob] = useState<{ x: number; y: number } | null>(null);
  const width = Math.round(s * 2.7);
  const height = Math.round(s * 1.55);

  const update = (e: RPointerEvent) => {
    const el = ref.current;
    const inp = input.current;
    if (!el || !inp) return;
    const r = el.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / (r.width / 2); // -1..1
    const dy = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const dead = 0.18;
    const wasJump = inp.jump;
    inp.left = dx < -dead;
    inp.right = dx > dead;
    inp.jump = dy < -0.55; // swipe up
    if (inp.jump && !wasJump) buzz(vibrate);
    setKnob({ x: Math.max(-1, Math.min(1, dx)), y: Math.max(-1, Math.min(1, dy)) });
  };
  const release = () => {
    pid.current = null;
    const inp = input.current;
    if (inp) inp.left = inp.right = inp.jump = false;
    setKnob(null);
  };

  return (
    <div
      ref={ref}
      role="group"
      aria-label="Bàn di chuyển: kéo trái phải, vuốt lên để nhảy"
      className={cn('relative touch-none rounded-[22px] border-[2.5px] border-ink/70 bg-paper-3/55 backdrop-blur-[2px]', className)}
      style={{ width, height }}
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        e.preventDefault();
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        update(e);
      }}
      onPointerMove={(e) => e.pointerId === pid.current && update(e)}
      onPointerUp={(e) => e.pointerId === pid.current && release()}
      onPointerCancel={(e) => e.pointerId === pid.current && release()}
      onLostPointerCapture={(e) => e.pointerId === pid.current && release()}
    >
      <svg viewBox="0 0 270 155" className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden>
        <path d="M60 77 l 26 -22 v 44 z" fill={knob && knob.x < -0.18 ? 'var(--cobalt)' : 'var(--ink)'} opacity="0.8" />
        <path d="M210 77 l -26 -22 v 44 z" fill={knob && knob.x > 0.18 ? 'var(--cobalt)' : 'var(--ink)'} opacity="0.8" />
        <path d="M135 22 l -16 16 h 32 z" fill={knob && knob.y < -0.55 ? 'var(--cobalt)' : 'var(--ink)'} opacity="0.55" />
        <line x1="135" y1="50" x2="135" y2="105" stroke="var(--ink)" strokeWidth="2" strokeDasharray="4 6" opacity="0.35" />
      </svg>
      <span
        className="pointer-events-none absolute rounded-full border-[2.5px] border-ink bg-marker/90 shadow-ink-sm transition-transform duration-75"
        style={{
          width: s * 0.62,
          height: s * 0.62,
          left: `calc(50% - ${s * 0.31}px)`,
          top: `calc(50% - ${s * 0.31}px)`,
          transform: knob ? `translate(${knob.x * (width / 2 - s * 0.36)}px, ${knob.y * (height / 2 - s * 0.36)}px)` : undefined,
          opacity: knob ? 1 : 0.6,
        }}
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Action buttons                                                      */
/* ------------------------------------------------------------------ */
function PadButton({
  s,
  label,
  children,
  onDown,
  onUp,
  tone = 'paper',
  active,
  cd = 0,
  charge,
  vibrate,
  big = false,
}: {
  s: number;
  label: string;
  children: ReactNode;
  onDown: () => void;
  onUp?: () => void;
  tone?: 'paper' | 'red' | 'blue' | 'violet';
  active?: boolean;
  cd?: number;
  charge?: number;
  vibrate: boolean;
  big?: boolean;
}) {
  const pid = useRef<number | null>(null);
  const [held, setHeld] = useState(false);
  const size = big ? s * 1.18 : s;
  const ready = charge === undefined || charge >= 1;
  const end = () => {
    pid.current = null;
    setHeld(false);
    onUp?.();
  };
  return (
    <button
      aria-label={label}
      className={cn(
        'relative grid touch-none place-items-center overflow-hidden rounded-full border-[2.5px] border-ink font-display shadow-ink-sm select-none',
        tone === 'red' && 'bg-crimson/85 text-on-accent',
        tone === 'blue' && 'bg-cobalt/85 text-on-accent',
        tone === 'violet' && (ready ? 'bg-violet text-on-accent anim-wobble' : 'bg-paper-3/70 text-ink'),
        tone === 'paper' && 'bg-paper-3/70 text-ink',
        (held || active) && 'translate-y-0.5 scale-95 brightness-110',
      )}
      style={{ width: size, height: size, fontSize: size * 0.3 }}
      onPointerDown={(e) => {
        if (pid.current !== null) return;
        e.preventDefault();
        pid.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        setHeld(true);
        buzz(vibrate);
        onDown();
      }}
      onPointerUp={(e) => e.pointerId === pid.current && end()}
      onPointerCancel={(e) => e.pointerId === pid.current && end()}
      onLostPointerCapture={(e) => e.pointerId === pid.current && end()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {charge !== undefined && !ready && <span className="absolute inset-x-0 bottom-0 bg-violet/45" style={{ height: `${charge * 100}%` }} aria-hidden />}
      {cd > 0 && <span className="absolute inset-x-0 top-0 bg-ink/35" style={{ height: `${Math.min(1, cd) * 100}%` }} aria-hidden />}
      <span className="relative flex flex-col items-center leading-none">{children}</span>
    </button>
  );
}

export function ActionCluster({
  input,
  s,
  vibrate,
  punchCd,
  kickCd,
  blocking,
  energy,
  className,
}: {
  input: React.RefObject<InputState>;
  s: number;
  vibrate: boolean;
  punchCd: number;
  kickCd: number;
  blocking: boolean;
  energy: number;
  className?: string;
}) {
  const set = (k: keyof InputState, v = true) => () => {
    if (input.current) input.current[k] = v;
  };
  const gap = Math.round(s * 0.16);
  const label = (txt: string) => <span style={{ fontSize: Math.max(9, s * 0.17) }} className="mt-0.5 font-hand">{txt}</span>;
  return (
    <div className={cn('grid touch-none items-end', className)} style={{ gridTemplateColumns: 'repeat(3, auto)', gap }}>
      <span />
      <PadButton s={s} label="Đá" onDown={set('kick')} cd={kickCd} vibrate={vibrate}>
        K{label('Đá')}
      </PadButton>
      <PadButton s={s} label="Đỡ đòn" onDown={set('block')} onUp={set('block', false)} active={blocking} tone="blue" vibrate={vibrate}>
        <Shield size={s * 0.34} strokeWidth={2.6} />
        {label('Đỡ')}
      </PadButton>
      <PadButton s={s} label="Tuyệt chiêu" onDown={set('super')} tone="violet" charge={energy} vibrate={vibrate}>
        Q{label('Nộ')}
      </PadButton>
      <PadButton s={s} label="Đấm" onDown={set('punch')} cd={punchCd} tone="red" vibrate={vibrate} big>
        J{label('Đấm')}
      </PadButton>
      <PadButton s={s} label="Nhảy" onDown={set('jump')} onUp={set('jump', false)} vibrate={vibrate} big>
        <ArrowBigUp size={s * 0.42} strokeWidth={2.4} />
        {label('Nhảy')}
      </PadButton>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Fullscreen + landscape lock (Android / desktop; iPhone ignores it)  */
/* ------------------------------------------------------------------ */
export const canFullscreen = () => typeof document !== 'undefined' && !!document.fullscreenEnabled;

export async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
    const o = screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> };
    await o.lock?.('landscape').catch(() => {});
  } catch {
    /* not allowed here — ignore */
  }
}

export function useIsFullscreen() {
  const [fs, setFs] = useState(() => typeof document !== 'undefined' && !!document.fullscreenElement);
  useEffect(() => {
    const on = () => setFs(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', on);
    return () => document.removeEventListener('fullscreenchange', on);
  }, []);
  return fs;
}

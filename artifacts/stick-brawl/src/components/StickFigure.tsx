import { useEffect, useRef } from 'react';
import { ACCESSORIES as CORE_ACCESSORIES, WEAPONS as CORE_WEAPONS, type Accessory, type Weapon } from '@workspace/game-core';


export type Pose =
  | 'idle'
  | 'run'
  | 'punch'
  | 'kick'
  | 'jump'
  | 'block'
  | 'hurt'
  | 'ko'
  | 'victory'
  | 'taunt';

export type { Accessory, Weapon };

export const POSES: Pose[] = ['idle', 'run', 'punch', 'kick', 'jump', 'block', 'hurt', 'ko', 'victory', 'taunt'];
export const ACCESSORIES: readonly Accessory[] = CORE_ACCESSORIES;
export const WEAPONS: readonly Weapon[] = CORE_WEAPONS;

/**
 * Joint angles in degrees. 0 = limb pointing straight down,
 * positive = rotated "forward" (toward the direction the figure faces).
 * Fore/lower angles are relative to the upper segment.
 */
type Angles = {
  bob: number;
  lean: number;
  head: number;
  aFu: number;
  aFl: number;
  aBu: number;
  aBl: number;
  lFu: number;
  lFl: number;
  lBu: number;
  lBl: number;
  lie: number; // 0 = standing, 1 = lying flat (KO)
};

const S = Math.sin;
const C = Math.cos;
const P = Math.PI;

const pulse = (t: number, period: number, active: number) => {
  const c = (t % period) / period;
  return c < active ? S((c / active) * P) : 0;
};

const POSE_FN: Record<Pose, (t: number) => Angles> = {
  idle: (t) => {
    const s = S(t * 4);
    return { bob: s * 1.2, lean: 4, head: 0, aFu: 35 + s * 3, aFl: 105, aBu: 15 + s * 3, aBl: 120, lFu: 20, lFl: -12, lBu: -16, lBl: -8, lie: 0 };
  },
  run: (t) => {
    const p = t * 11;
    const s = S(p);
    const c = C(p);
    return {
      bob: -Math.abs(c) * 3,
      lean: 12,
      head: -4,
      aFu: -s * 45 + 10,
      aFl: 80,
      aBu: s * 45 + 10,
      aBl: 80,
      lFu: s * 42 + 5,
      lFl: -20 - Math.max(0, c) * 55,
      lBu: -s * 42 + 5,
      lBl: -20 - Math.max(0, -c) * 55,
      lie: 0,
    };
  },
  punch: (t) => {
    const e = pulse(t, 0.45, 0.45);
    return { bob: 0, lean: 4 + e * 12, head: 0, aFu: 35 + e * 57, aFl: 105 * (1 - e), aBu: 15 - e * 10, aBl: 120, lFu: 28, lFl: -10, lBu: -24, lBl: -6, lie: 0 };
  },
  kick: (t) => {
    const e = pulse(t, 0.6, 0.6);
    return { bob: -e * 2, lean: 4 - e * 20, head: e * 6, aFu: 40, aFl: 100, aBu: -10 - e * 30, aBl: 60, lFu: 20 + e * 78, lFl: -40 * (1 - e), lBu: -14, lBl: -6, lie: 0 };
  },
  jump: (t) => ({ bob: -2 + S(t * 6) * 1, lean: 6, head: -6, aFu: 145, aFl: 15, aBu: 120, aBl: 20, lFu: 62, lFl: -95, lBu: 12, lBl: -75, lie: 0 }),
  block: (t) => {
    const s = S(t * 5) * 1.5;
    return { bob: 1 + s * 0.4, lean: -4, head: 8, aFu: 72 + s, aFl: 112, aBu: 62 + s, aBl: 118, lFu: 26, lFl: -14, lBu: -22, lBl: -10, lie: 0 };
  },
  hurt: (t) => {
    const s = S(t * 22);
    return { bob: 0, lean: -20, head: -18, aFu: -35 + s * 12, aFl: 30, aBu: -55 - s * 10, aBl: 25, lFu: 12, lFl: -22, lBu: -24, lBl: -10, lie: 0 };
  },
  ko: () => ({ bob: 0, lean: 0, head: 10, aFu: 110, aFl: 15, aBu: -70, aBl: 25, lFu: 25, lFl: -5, lBu: -18, lBl: 0, lie: 1 }),
  victory: (t) => {
    const s = S(t * 10);
    return { bob: -Math.abs(S(t * 5)) * 7, lean: 0, head: -8, aFu: 160 + s * 12, aFl: -10, aBu: 150 - s * 12, aBl: -10, lFu: 14, lFl: -6, lBu: -12, lBl: -6, lie: 0 };
  },
  taunt: (t) => {
    const s = S(t * 8);
    return { bob: S(t * 4) * 1, lean: -6, head: 10, aFu: 82, aFl: 60 + s * 40, aBu: -25, aBl: -70, lFu: 10, lFl: -4, lBu: -14, lBl: -4, lie: 0 };
  },
};

const KEYS = Object.keys(POSE_FN.idle(0)) as (keyof Angles)[];

// geometry (viewBox -20 0 140 130)
const SH = { x: 50, y: 44 };
const HIP = { x: 50, y: 78 };
const ELBOW_Y = 62;
const HAND_Y = 79;
const KNEE_Y = 102;
const FOOT_Y = 125;

type Props = {
  color?: string;
  pose?: Pose;
  facing?: 1 | -1;
  accessory?: Accessory;
  weapon?: Weapon;
  className?: string;
  /** stroke width in viewBox units */
  stroke?: number;
  /** shared phase offset so a crowd doesn't move in lock-step */
  phase?: number;
  title?: string;
};

export function StickFigure({
  color = 'var(--ink)',
  pose = 'idle',
  facing = 1,
  accessory = 'none',
  weapon = 'none',
  className,
  stroke = 5,
  phase = 0,
  title,
}: Props) {
  const refs = {
    root: useRef<SVGGElement>(null),
    torso: useRef<SVGGElement>(null),
    head: useRef<SVGGElement>(null),
    aFu: useRef<SVGGElement>(null),
    aFl: useRef<SVGGElement>(null),
    aBu: useRef<SVGGElement>(null),
    aBl: useRef<SVGGElement>(null),
    lFu: useRef<SVGGElement>(null),
    lFl: useRef<SVGGElement>(null),
    lBu: useRef<SVGGElement>(null),
    lBl: useRef<SVGGElement>(null),
  };
  const eyesOpen = useRef<SVGGElement>(null);
  const eyesX = useRef<SVGGElement>(null);
  const eyesHurt = useRef<SVGGElement>(null);
  const poseRef = useRef(pose);
  const startRef = useRef(performance.now());
  const cur = useRef<Angles | null>(null);

  useEffect(() => {
    if (poseRef.current !== pose) {
      poseRef.current = pose;
      startRef.current = performance.now();
    }
  }, [pose]);

  useEffect(() => {
    let raf = 0;
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const tick = (now: number) => {
      const t = reduce ? 0.2 : (now - startRef.current) / 1000 + phase;
      const target = POSE_FN[poseRef.current](t);
      if (!cur.current) cur.current = { ...target };
      const c = cur.current;
      for (const k of KEYS) c[k] += (target[k] - c[k]) * 0.35;

      const rot = (el: SVGGElement | null, a: number, x: number, y: number) =>
        el?.setAttribute('transform', `rotate(${-a} ${x} ${y})`);

      const lieA = c.lie * 84;
      refs.root.current?.setAttribute(
        'transform',
        `translate(${-c.lie * 40} ${c.bob}) rotate(${lieA} 50 ${FOOT_Y - 6})`,
      );
      rot(refs.torso.current, c.lean, HIP.x, HIP.y);
      rot(refs.head.current, c.head, SH.x, 36);
      rot(refs.aFu.current, c.aFu, SH.x, SH.y);
      rot(refs.aFl.current, c.aFl, SH.x, ELBOW_Y);
      rot(refs.aBu.current, c.aBu, SH.x, SH.y);
      rot(refs.aBl.current, c.aBl, SH.x, ELBOW_Y);
      rot(refs.lFu.current, c.lFu, HIP.x, HIP.y);
      rot(refs.lFl.current, c.lFl, HIP.x, KNEE_Y);
      rot(refs.lBu.current, c.lBu, HIP.x, HIP.y);
      rot(refs.lBl.current, c.lBl, HIP.x, KNEE_Y);

      const p = poseRef.current;
      eyesOpen.current?.setAttribute('display', p === 'ko' || p === 'hurt' ? 'none' : 'inline');
      eyesX.current?.setAttribute('display', p === 'ko' ? 'inline' : 'none');
      eyesHurt.current?.setAttribute('display', p === 'hurt' ? 'inline' : 'none');
      if (!reduce) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const line = { stroke: color, strokeWidth: stroke, strokeLinecap: 'round' as const, fill: 'none' };
  const back = { ...line, opacity: 0.55 };

  return (
    <svg
      viewBox="-20 0 140 130"
      className={className}
      style={{ transform: facing === -1 ? 'scaleX(-1)' : undefined, overflow: 'visible' }}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <ellipse cx="50" cy="127" rx="22" ry="3" fill="var(--ink)" opacity="0.12" />
      <g ref={refs.root}>
        {/* back leg */}
        <g ref={refs.lBu}>
          <line x1={HIP.x} y1={HIP.y} x2={HIP.x} y2={KNEE_Y} {...back} />
          <g ref={refs.lBl}>
            <line x1={HIP.x} y1={KNEE_Y} x2={HIP.x} y2={FOOT_Y} {...back} />
          </g>
        </g>
        <g ref={refs.torso}>
          {/* back arm */}
          <g ref={refs.aBu}>
            <line x1={SH.x} y1={SH.y} x2={SH.x} y2={ELBOW_Y} {...back} />
            <g ref={refs.aBl}>
              <line x1={SH.x} y1={ELBOW_Y} x2={SH.x} y2={HAND_Y} {...back} />
            </g>
          </g>
          {/* spine */}
          <line x1={HIP.x} y1={HIP.y} x2={SH.x} y2={34} {...line} />
          {/* head */}
          <g ref={refs.head}>
            <AccessoryBack kind={accessory} color={color} />
            <circle cx="50" cy="23" r="11.5" fill="var(--paper-3)" stroke={color} strokeWidth={stroke} />
            <g ref={eyesOpen}>
              {accessory === 'ninja' ? null : (
                <>
                  <circle cx="54.5" cy="21.5" r="1.7" fill={color} />
                  <circle cx="59.5" cy="21.5" r="1.7" fill={color} />
                  <line x1="52" y1="16.8" x2="57" y2="18.3" stroke={color} strokeWidth="1.6" strokeLinecap="round" />
                </>
              )}
            </g>
            <g ref={eyesHurt} display="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
              <path d="M52 20 l3 2 l-3 2 M61 20 l-3 2 l3 2" fill="none" />
            </g>
            <g ref={eyesX} display="none" stroke={color} strokeWidth="1.8" strokeLinecap="round">
              <path d="M52 19 l4 4 M56 19 l-4 4 M57.5 19 l4 4 M61.5 19 l-4 4" />
            </g>
            <AccessoryFront kind={accessory} color={color} />
          </g>
          {/* front arm */}
          <g ref={refs.aFu}>
            <line x1={SH.x} y1={SH.y} x2={SH.x} y2={ELBOW_Y} {...line} />
            <g ref={refs.aFl}>
              <WeaponShape kind={weapon} color={color} />
              <line x1={SH.x} y1={ELBOW_Y} x2={SH.x} y2={HAND_Y} {...line} />
              <circle cx={SH.x} cy={HAND_Y + 1} r={stroke * 0.75} fill={color} />
            </g>
          </g>
        </g>
        {/* front leg */}
        <g ref={refs.lFu}>
          <line x1={HIP.x} y1={HIP.y} x2={HIP.x} y2={KNEE_Y} {...line} />
          <g ref={refs.lFl}>
            <line x1={HIP.x} y1={KNEE_Y} x2={HIP.x} y2={FOOT_Y} {...line} />
          </g>
        </g>
      </g>
    </svg>
  );
}

function AccessoryBack({ kind, color }: { kind: Accessory; color: string }) {
  if (kind === 'headband' || kind === 'ninja') {
    const fill = kind === 'ninja' ? 'var(--ink)' : 'var(--crimson)';
    return (
      <g className="anim-flutter">
        <path d="M40 18 C 32 14, 26 20, 18 15 L 20 21 C 27 25, 33 20, 40 22 Z" fill={fill} stroke={color} strokeWidth="1.5" />
        <path d="M40 20 C 33 22, 28 28, 21 27 L 24 32 C 31 32, 35 25, 41 23 Z" fill={fill} stroke={color} strokeWidth="1.5" />
      </g>
    );
  }
  return null;
}

function AccessoryFront({ kind, color }: { kind: Accessory; color: string }) {
  switch (kind) {
    case 'headband':
      return <path d="M38.8 18.5 Q 50 14 61.6 18.5 L 61.4 22 Q 50 17.8 38.6 22 Z" fill="var(--crimson)" stroke={color} strokeWidth="1.5" />;
    case 'ninja':
      return (
        <g>
          <path d="M38.6 16 Q 50 12 61.8 16 L 61.6 26 Q 50 22.5 38.6 26 Z" fill="var(--ink)" stroke={color} strokeWidth="1.2" />
          <path d="M52 20.5 l5 1 M57.5 21.5 l4.5 -1" stroke="var(--paper-3)" strokeWidth="2" strokeLinecap="round" />
        </g>
      );
    case 'cap':
      return (
        <g>
          <path d="M38.5 20 Q 39 9 50 9 Q 61 9 61.5 19 Z" fill="var(--cobalt)" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <path d="M57 19 Q 66 18 71 21 Q 64 22.5 57 21.5 Z" fill="var(--cobalt)" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <circle cx="50" cy="9.5" r="1.8" fill={color} />
        </g>
      );
    case 'crown':
      return <path d="M40 13 L 41 3 L 45.5 8 L 50 1 L 54.5 8 L 59 3 L 60 13 Z" fill="var(--marker)" stroke={color} strokeWidth="2" strokeLinejoin="round" />;
    case 'horns':
      return (
        <g fill="var(--crimson)" stroke={color} strokeWidth="1.8" strokeLinejoin="round">
          <path d="M42 15 Q 35 8 38 1 Q 41 8 46 12 Z" />
          <path d="M57 12 Q 62 7 61 0 Q 66 8 61 15 Z" />
        </g>
      );
    case 'halo':
      return (
        <ellipse cx="50" cy="5" rx="12" ry="3.5" fill="none" stroke="var(--marker)" strokeWidth="3" className="anim-float" />
      );
    default:
      return null;
  }
}

function WeaponShape({ kind, color }: { kind: Weapon; color: string }) {
  switch (kind) {
    case 'sword':
      return (
        <g strokeLinecap="round">
          <path d="M50 84 L 50 114 L 47.5 110 L 47.5 84 Z" fill="var(--paper-3)" stroke={color} strokeWidth="2" strokeLinejoin="round" />
          <line x1="43" y1="83" x2="56" y2="83" stroke={color} strokeWidth="3.5" />
          <line x1="50" y1="74" x2="50" y2="82" stroke="var(--crimson)" strokeWidth="3.5" />
        </g>
      );
    case 'staff':
      return <line x1="50" y1="50" x2="50" y2="118" stroke="var(--mint)" strokeWidth="4" strokeLinecap="round" />;
    case 'hammer':
      return (
        <g>
          <line x1="50" y1="70" x2="50" y2="104" stroke={color} strokeWidth="3.5" strokeLinecap="round" />
          <rect x="40" y="102" width="20" height="13" rx="2" fill="var(--violet)" stroke={color} strokeWidth="2.5" />
        </g>
      );
    default:
      return null;
  }
}

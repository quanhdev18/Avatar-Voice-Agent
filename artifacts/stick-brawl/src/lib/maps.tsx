/**
 * Arena visuals. Geometry comes from @workspace/game-core (the same data the
 * server collides against); each map adds its own hand-drawn decoration.
 */
import { useId, type ReactNode } from 'react';
import { Check, Dices, Lock } from 'lucide-react';
import {
  GROUND,
  H,
  LAVA_Y,
  MAPS,
  MAP_IDS,
  W,
  platformAt,
  windAt,
  type MapChoice,
  type MapDef,
  type MapId,
  type Platform,
} from '@workspace/game-core';

import { cn } from '@/lib/utils';

export const MAP_ACCENT: Record<MapId, string> = {
  notebook: 'var(--cobalt)',
  rooftop: 'var(--violet)',
  volcano: '#f2802e',
  dojo: 'var(--mint)',
};

export const mapLabel = (c: MapChoice) => (c === 'random' ? 'Ngẫu nhiên' : MAPS[c].name);

const INK = 'var(--ink)';
const LAVA = '#f2802e';
const LAVA_HI = 'var(--marker)';
const ROCK = 'color-mix(in srgb, var(--ink) 55%, var(--paper-2))';
const WOOD = 'color-mix(in srgb, #b07a3c 55%, var(--paper-2))';

/* ------------------------------------------------------------------ */
/* Full arena (background decor + collision geometry)                  */
/* ------------------------------------------------------------------ */
export function ArenaScene({ mapId, t = 0, still = false, className }: { mapId: MapId; t?: number; still?: boolean; className?: string }) {
  const uid = useId().replace(/:/g, '');
  const map = MAPS[mapId];
  const time = still ? 0 : t;
  const wind = still ? 0 : windAt(map, time);
  const hatch = `hatch-${uid}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn('h-full w-full', className)} preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <pattern id={hatch} width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1="0" y1="0" x2="0" y2="10" stroke={INK} strokeWidth="2" opacity="0.25" />
        </pattern>
      </defs>
      {Array.from({ length: 17 }).map((_, i) => (
        <line key={i} x1="0" x2={W} y1={i * 32 + 16} y2={i * 32 + 16} stroke="var(--rule)" strokeWidth="1.5" />
      ))}
      {mapId === 'notebook' && <NotebookBack />}
      {mapId === 'rooftop' && <RooftopBack wind={wind} t={time} />}
      {mapId === 'volcano' && <VolcanoBack t={time} />}
      {mapId === 'dojo' && <DojoBack map={map} />}

      <Ground map={map} hatch={hatch} />
      <Lava map={map} t={time} />
      {map.platforms.map((p, i) => (
        <PlatformShape key={i} mapId={mapId} p={p} t={time} hatch={hatch} />
      ))}
      {mapId === 'dojo' && <DojoWalls map={map} />}
      {wind !== 0 && <WindStreaks dir={wind > 0 ? 1 : -1} t={time} />}
    </svg>
  );
}

function Ground({ map, hatch }: { map: MapDef; hatch: string }) {
  const fill = map.id === 'volcano' ? ROCK : map.id === 'dojo' ? WOOD : map.id === 'rooftop' ? 'color-mix(in srgb, var(--ink) 18%, var(--paper-2))' : 'var(--paper-2)';
  return (
    <g>
      {map.ground.map((s, i) => {
        const mid = (s.x1 + s.x2) / 2;
        return (
          <g key={i}>
            <path
              d={`M${s.x1} ${GROUND} Q ${mid} ${GROUND - 5} ${s.x2} ${GROUND} L ${s.x2} ${H + 5} L ${s.x1} ${H + 5} Z`}
              fill={fill}
              stroke={INK}
              strokeWidth="4"
              strokeLinejoin="round"
            />
            <rect x={s.x1} y={GROUND + 6} width={s.x2 - s.x1} height={H - GROUND} fill={`url(#${hatch})`} />
            {map.id === 'rooftop' && <Windows x1={s.x1} x2={s.x2} />}
            {map.id === 'dojo' &&
              Array.from({ length: 12 }).map((_, k) => (
                <line key={k} x1={s.x1 + k * 85} y1={GROUND + 4} x2={s.x1 + k * 85 - 30} y2={H} stroke={INK} strokeWidth="2" opacity="0.35" />
              ))}
            {map.id === 'volcano' && (
              <path d={`M${s.x1 + 60} ${GROUND + 8} l 25 30 l -10 25 M${s.x2 - 120} ${GROUND + 10} l -20 35 M${mid} ${GROUND + 6} l 15 22 l 20 6`} stroke={INK} strokeWidth="2.5" fill="none" opacity="0.6" />
            )}
          </g>
        );
      })}
    </g>
  );
}

function Windows({ x1, x2 }: { x1: number; x2: number }) {
  const cols = Math.floor((x2 - x1 - 40) / 60);
  return (
    <g>
      {Array.from({ length: cols }).map((_, c) =>
        [0, 1].map((r) => (
          <rect key={`${c}-${r}`} x={x1 + 30 + c * 60} y={GROUND + 22 + r * 34} width="30" height="20" rx="2" fill={(c + r) % 3 === 0 ? 'var(--marker)' : 'var(--paper-3)'} stroke={INK} strokeWidth="2" />
        )),
      )}
    </g>
  );
}

function Lava({ map, t }: { map: MapDef; t: number }) {
  return (
    <g>
      {map.lava.map((s, i) => {
        const pts: string[] = [];
        for (let x = s.x1; x <= s.x2; x += 10) pts.push(`${x} ${LAVA_Y + Math.sin(x / 22 + t * 3) * 4}`);
        return (
          <g key={i}>
            <path d={`M${pts.join(' L ')} L ${s.x2} ${H + 5} L ${s.x1} ${H + 5} Z`} fill={LAVA} stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
            <path d={`M${pts.slice(1, -1).join(' L ')}`} fill="none" stroke={LAVA_HI} strokeWidth="4" strokeLinecap="round" strokeDasharray="18 26" transform="translate(0 9)" />
            {[0, 1, 2].map((b) => {
              const bx = s.x1 + ((b * 67 + t * 25) % (s.x2 - s.x1 - 20)) + 10;
              const by = H - (((t * 40 + b * 23) % 50) + 15);
              return <circle key={b} cx={bx} cy={by} r={4 + b} fill={LAVA_HI} stroke={INK} strokeWidth="1.5" opacity="0.85" />;
            })}
          </g>
        );
      })}
    </g>
  );
}

function PlatformShape({ mapId, p, t, hatch }: { mapId: MapId; p: Platform; t: number; hatch: string }) {
  const { x1, x2, y } = platformAt(p, t);
  const mid = (x1 + x2) / 2;
  const fill = mapId === 'volcano' ? ROCK : mapId === 'rooftop' && p.move ? 'var(--marker)' : 'var(--paper-2)';
  return (
    <g>
      {mapId === 'rooftop' && p.move && (
        // gondola cables
        <g stroke={INK} strokeWidth="2.5">
          <line x1={x1 + 12} y1={y} x2={x1 + 12} y2={0} />
          <line x1={x2 - 12} y1={y} x2={x2 - 12} y2={0} />
        </g>
      )}
      {mapId === 'volcano' && p.move && (
        <path d={`M${x1 + 20} ${y + 20} q 0 30 -10 60 M${x2 - 20} ${y + 20} q 0 30 10 60`} stroke={INK} strokeWidth="2.5" fill="none" strokeDasharray="6 6" />
      )}
      <path
        d={`M${x1 - 6} ${y} Q ${mid} ${y - 5} ${x2 + 6} ${y} L ${x2} ${y + 22} Q ${mid} ${y + 18} ${x1} ${y + 22} Z`}
        fill={fill}
        stroke={INK}
        strokeWidth="3.5"
        strokeLinejoin="round"
      />
      <rect x={x1 + 4} y={y + 4} width={Math.max(0, x2 - x1 - 8)} height="14" fill={`url(#${hatch})`} />
      {p.move && <path d={`M${mid - 14} ${y + 11} h 28 M${mid + 8} ${y + 6} l 6 5 l -6 5 M${mid - 8} ${y + 6} l -6 5 l 6 5`} stroke={INK} strokeWidth="2" fill="none" />}
    </g>
  );
}

function WindStreaks({ dir, t }: { dir: 1 | -1; t: number }) {
  return (
    <g stroke={INK} strokeWidth="3" strokeLinecap="round" opacity="0.45">
      {Array.from({ length: 9 }).map((_, i) => {
        const y = 60 + i * 47;
        const x = ((((i * 137 + t * 900 * dir) % 1200) + 1200) % 1200) - 100;
        return <path key={i} d={`M${x} ${y} h ${80 * dir} q ${20 * dir} 0 ${20 * dir} -12`} fill="none" />;
      })}
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Per-map backgrounds                                                 */
/* ------------------------------------------------------------------ */
function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <path
      transform={`translate(${x} ${y}) scale(${s})`}
      d="M0 0 q 25 -30 55 -6 q 25 -24 50 2 q 18 22 -12 26 h -86 q -30 -6 -7 -22z"
      fill="var(--paper-3)"
      stroke={INK}
      strokeWidth="3"
    />
  );
}

function NotebookBack() {
  return (
    <g>
      <circle cx="880" cy="80" r="38" fill="var(--marker)" stroke={INK} strokeWidth="3" />
      <Cloud x={90} y={90} />
      <Cloud x={520} y={70} s={0.75} />
    </g>
  );
}

function RooftopBack({ wind, t }: { wind: number; t: number }) {
  const flap = wind === 0 ? Math.sin(t * 2) * 6 : 40 * Math.sign(wind);
  return (
    <g>
      <circle cx="160" cy="80" r="30" fill="var(--paper-3)" stroke={INK} strokeWidth="3" />
      <path d="M150 62 a 22 22 0 1 0 26 30 a 18 18 0 1 1 -26 -30z" fill="var(--marker)" stroke={INK} strokeWidth="2" />
      {/* skyline */}
      <g fill="color-mix(in srgb, var(--ink) 12%, transparent)" stroke={INK} strokeWidth="2.5" opacity="0.8">
        {[
          [20, 250, 90],
          [120, 210, 70],
          [205, 280, 60],
          [280, 190, 80],
          [380, 240, 55],
          [450, 170, 70],
          [540, 230, 60],
          [620, 200, 85],
          [720, 260, 60],
          [790, 180, 75],
          [880, 230, 100],
        ].map(([x, y, w]) => (
          <rect key={x} x={x} y={y} width={w} height={GROUND - y!} />
        ))}
      </g>
      {/* alley between the roofs */}
      <path d="M400 480 v 80 M500 470 v 90 M600 485 v 75" stroke={INK} strokeWidth="2" strokeDasharray="8 10" opacity="0.4" />
      {/* water tank + antenna on the roofs */}
      <g stroke={INK} strokeWidth="3" fill="var(--paper-3)">
        <path d="M40 470 v -40 M80 470 v -40" fill="none" />
        <rect x="30" y="392" width="60" height="40" rx="6" />
        <path d="M960 470 v -95" fill="none" />
        <path d="M945 390 l 15 -15 l 15 15" fill="none" />
      </g>
      {/* flag shows the wind */}
      <g>
        <line x1="320" y1="470" x2="320" y2="395" stroke={INK} strokeWidth="3" />
        <path d={`M320 398 q ${flap / 2} -6 ${flap} 2 q ${-flap / 4} 6 ${-flap} 14 z`} fill="var(--crimson)" stroke={INK} strokeWidth="2" />
      </g>
    </g>
  );
}

function VolcanoBack({ t }: { t: number }) {
  return (
    <g>
      <path d="M260 470 L 430 150 Q 500 130 570 150 L 740 470 Z" fill="color-mix(in srgb, var(--ink) 22%, var(--paper-2))" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
      <path d="M430 150 q 20 40 10 80 q 30 -20 40 30 q 15 -35 40 -10 q 0 -50 50 -100" fill={LAVA} stroke={INK} strokeWidth="3" strokeLinejoin="round" />
      {[0, 1, 2].map((i) => {
        const k = (t * 0.25 + i / 3) % 1;
        return <circle key={i} cx={500 + Math.sin(k * 6 + i) * 30} cy={130 - k * 110} r={18 + k * 26} fill="var(--paper-3)" stroke={INK} strokeWidth="2.5" opacity={1 - k} />;
      })}
      {Array.from({ length: 6 }).map((_, i) => {
        const k = (t * 0.35 + i / 6) % 1;
        return <circle key={`e${i}`} cx={80 + i * 170 + Math.sin(t * 2 + i) * 15} cy={H - 40 - k * 420} r="3.5" fill={LAVA_HI} opacity={1 - k} />;
      })}
    </g>
  );
}

function DojoBack({ map }: { map: MapDef }) {
  const { x1, x2 } = map.bounds;
  return (
    <g>
      <rect x={x1} y="40" width={x2 - x1} height={GROUND - 40} fill="color-mix(in srgb, var(--paper-3) 70%, #e9d8b6)" stroke={INK} strokeWidth="3" />
      {/* shoji grid */}
      <g stroke={INK} strokeWidth="2" opacity="0.35">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={x1 + ((x2 - x1) / 9) * (i + 1)} y1="40" x2={x1 + ((x2 - x1) / 9) * (i + 1)} y2={GROUND} />
        ))}
        {[130, 220, 310, 400].map((y) => (
          <line key={y} x1={x1} y1={y} x2={x2} y2={y} />
        ))}
      </g>
      {/* hanging scroll */}
      <g>
        <rect x="455" y="70" width="90" height="190" fill="var(--paper-3)" stroke={INK} strokeWidth="3" />
        <line x1="445" y1="70" x2="555" y2="70" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <line x1="445" y1="262" x2="555" y2="262" stroke={INK} strokeWidth="6" strokeLinecap="round" />
        <text x="500" y="185" textAnchor="middle" fontFamily="Bungee, Impact, sans-serif" fontSize="44" fill="var(--crimson)">
          VÕ
        </text>
      </g>
      {/* lanterns */}
      {[260, 740].map((x) => (
        <g key={x}>
          <line x1={x} y1="40" x2={x} y2="90" stroke={INK} strokeWidth="2.5" />
          <ellipse cx={x} cy="120" rx="24" ry="32" fill="var(--crimson)" stroke={INK} strokeWidth="3" />
          <path d={`M${x - 22} 110 h 44 M${x - 22} 130 h 44`} stroke={INK} strokeWidth="2" />
        </g>
      ))}
    </g>
  );
}

function DojoWalls({ map }: { map: MapDef }) {
  const { x1, x2 } = map.bounds;
  return (
    <g fill={WOOD} stroke={INK} strokeWidth="3.5">
      <rect x={x1 - 36} y="20" width="26" height={GROUND - 20} />
      <rect x={x2 + 10} y="20" width="26" height={GROUND - 20} />
      <rect x="0" y="0" width={x1 - 36} height={H} fill="var(--paper-2)" />
      <rect x={x2 + 36} y="0" width={W - x2 - 36} height={H} fill="var(--paper-2)" />
    </g>
  );
}

/* ------------------------------------------------------------------ */
/* Picker                                                              */
/* ------------------------------------------------------------------ */
export function MapThumb({ choice, className }: { choice: MapChoice; className?: string }) {
  if (choice === 'random') {
    return (
      <div className={cn('relative grid aspect-[1000/560] place-items-center overflow-hidden bg-paper-2 hatch', className)}>
        <div className="grid grid-cols-2 gap-1 opacity-40">
          {MAP_IDS.map((id) => (
            <div key={id} className="h-8 w-14 overflow-hidden rounded-sm border-2 border-ink">
              <ArenaScene mapId={id} still />
            </div>
          ))}
        </div>
        <Dices size={40} strokeWidth={2.5} className="absolute text-ink" />
      </div>
    );
  }
  return (
    <div className={cn('aspect-[1000/560] overflow-hidden bg-paper-3', className)}>
      <ArenaScene mapId={choice} still />
    </div>
  );
}

export function MapCard({
  choice,
  selected,
  onSelect,
  disabled,
  compact = false,
  footer,
}: {
  choice: MapChoice;
  selected: boolean;
  onSelect?: () => void;
  disabled?: boolean;
  compact?: boolean;
  footer?: ReactNode;
}) {
  const def = choice === 'random' ? null : MAPS[choice];
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
      className={cn(
        'sk focus-ring group relative flex flex-col overflow-hidden bg-paper-3 text-left transition-transform disabled:cursor-default',
        selected ? 'shadow-ink -translate-y-1 ring-[3px] ring-marker ring-offset-2 ring-offset-paper' : !disabled && 'hover:-translate-y-0.5 hover:shadow-ink-sm',
      )}
    >
      <MapThumb choice={choice} className="border-b-[2.5px] border-ink" />
      <div className={cn('flex flex-1 flex-col gap-1', compact ? 'p-2' : 'p-3')}>
        <div className="flex items-center gap-2">
          <span className="h-3 w-3 shrink-0 rounded-full border-2 border-ink" style={{ background: def ? MAP_ACCENT[def.id] : 'var(--paper-2)' }} />
          <span className={cn('font-display leading-tight', compact ? 'text-xs' : 'text-sm')}>{mapLabel(choice)}</span>
        </div>
        {!compact && <p className="text-sm leading-snug text-ink-soft">{def ? def.desc : 'Bốc thăm một bản đồ khi trận bắt đầu.'}</p>}
        {!compact && (
          <div className="mt-auto flex flex-wrap gap-1 pt-1">
            {(def ? def.traits : ['Bất ngờ']).map((tr) => (
              <span key={tr} className="rounded-[6px_2px_7px_2px] border-[1.5px] border-ink bg-paper px-1.5 text-xs">
                {tr}
              </span>
            ))}
          </div>
        )}
        {footer}
      </div>
      {selected && (
        <span className={cn('absolute grid place-items-center rounded-full border-2 border-ink bg-mint', compact ? 'top-1 right-1 h-5 w-5' : 'top-2 right-2 h-7 w-7')}>
          <Check size={compact ? 11 : 16} strokeWidth={4} className="text-on-accent" />
        </span>
      )}
      {disabled && !selected && (
        <span className="absolute top-2 right-2 grid h-7 w-7 place-items-center rounded-full border-2 border-ink bg-paper-3">
          <Lock size={13} strokeWidth={3} />
        </span>
      )}
    </button>
  );
}

export function MapPicker({
  value,
  onChange,
  allowRandom = true,
  disabled = false,
  compact = false,
  className,
}: {
  value: MapChoice;
  onChange?: (c: MapChoice) => void;
  allowRandom?: boolean;
  disabled?: boolean;
  compact?: boolean;
  className?: string;
}) {
  const choices: MapChoice[] = allowRandom ? [...MAP_IDS, 'random'] : [...MAP_IDS];
  return (
    <div role="radiogroup" aria-label="Chọn bản đồ" className={cn('grid gap-3', compact ? 'grid-cols-3 sm:grid-cols-5' : 'grid-cols-1 sm:grid-cols-2', className)}>
      {choices.map((c) => (
        <MapCard key={c} choice={c} compact={compact} selected={value === c} disabled={disabled} onSelect={() => !disabled && onChange?.(c)} />
      ))}
    </div>
  );
}

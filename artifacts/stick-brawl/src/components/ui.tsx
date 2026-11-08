import { useEffect, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { X } from 'lucide-react';

import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Button                                                              */
/* ------------------------------------------------------------------ */
const BTN_VARIANT = {
  red: 'bg-crimson text-on-accent',
  blue: 'bg-cobalt text-on-accent',
  yellow: 'bg-marker text-on-marker',
  green: 'bg-mint text-on-accent',
  paper: 'bg-paper-3 text-ink',
  ink: 'bg-ink text-paper',
} as const;
const BTN_SIZE = {
  sm: 'text-xs px-3 py-1.5',
  md: 'text-sm px-5 py-2.5',
  lg: 'text-lg px-7 py-3.5',
  xl: 'text-2xl px-10 py-5',
} as const;

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BTN_VARIANT;
  size?: keyof typeof BTN_SIZE;
};

export function Button({ variant = 'paper', size = 'md', className, ...rest }: ButtonProps) {
  return <button className={cn('btn', BTN_VARIANT[variant], BTN_SIZE[size], className)} {...rest} />;
}

export function IconButton({ className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={cn('btn bg-paper-3 text-ink h-10 w-10 p-0', className)} {...rest} />;
}

/* ------------------------------------------------------------------ */
/* Panel — sketchy card with optional taped title                      */
/* ------------------------------------------------------------------ */
export function Panel({
  title,
  className,
  children,
  tape = false,
  tone = 'paper',
  action,
}: {
  title?: ReactNode;
  className?: string;
  children: ReactNode;
  tape?: boolean;
  tone?: 'paper' | 'paper-2' | 'marker';
  action?: ReactNode;
}) {
  const bg = tone === 'marker' ? 'bg-marker text-on-marker' : tone === 'paper-2' ? 'bg-paper-2' : 'bg-paper-3';
  return (
    <section className={cn('sk shadow-ink relative p-4', bg, className)}>
      {tape && <span className="tape -top-3 left-1/2 -translate-x-1/2 -rotate-3" aria-hidden />}
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-3">
          {title && <h2 className="font-display text-base tracking-wide uppercase">{title}</h2>}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Bar — HP / energy / XP                                              */
/* ------------------------------------------------------------------ */
export function Bar({
  value,
  max = 100,
  color = 'var(--mint)',
  segments = 0,
  className,
  label,
  showValue = false,
  height = 'h-4',
}: {
  value: number;
  max?: number;
  color?: string;
  segments?: number;
  className?: string;
  label?: string;
  showValue?: boolean;
  height?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div className={cn('w-full', className)}>
      {(label || showValue) && (
        <div className="mb-0.5 flex justify-between text-sm leading-none">
          <span>{label}</span>
          {showValue && (
            <span className="tabular-nums">
              {Math.round(value)}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className={cn('hatch relative overflow-hidden rounded-[6px_3px_7px_3px] border-2 border-ink bg-paper-2', height)}
        role="progressbar"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-label={label}
      >
        <div
          className="absolute inset-y-0 left-0 transition-[width] duration-200 ease-out"
          style={{ width: `${pct}%`, background: color }}
        >
          <div className="absolute inset-x-0 top-0 h-1/3 bg-white/30" />
        </div>
        {segments > 0 &&
          Array.from({ length: segments - 1 }).map((_, i) => (
            <span
              key={i}
              className="absolute inset-y-0 w-[2px] bg-ink/70"
              style={{ left: `${((i + 1) / segments) * 100}%` }}
            />
          ))}
      </div>
    </div>
  );
}

export const hpColor = (pct: number) => (pct > 0.5 ? 'var(--mint)' : pct > 0.25 ? 'var(--marker)' : 'var(--crimson)');

/* ------------------------------------------------------------------ */
/* Badge / Kbd / Chip                                                  */
/* ------------------------------------------------------------------ */
const BADGE = {
  red: 'bg-crimson text-on-accent',
  blue: 'bg-cobalt text-on-accent',
  yellow: 'bg-marker text-on-marker',
  green: 'bg-mint text-on-accent',
  paper: 'bg-paper-3 text-ink',
  ink: 'bg-ink text-paper',
} as const;

export function Badge({
  children,
  tone = 'paper',
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof BADGE;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[8px_3px_9px_3px] border-2 border-ink px-2 py-0.5 text-sm leading-tight whitespace-nowrap',
        BADGE[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex min-w-7 items-center justify-center rounded-[5px_2px_6px_2px] border-2 border-ink bg-paper-3 px-1.5 font-display text-[11px] shadow-[1px_2px_0_var(--ink)]">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Tabs (segmented)                                                    */
/* ------------------------------------------------------------------ */
export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode }[];
  className?: string;
}) {
  return (
    <div role="tablist" className={cn('sk inline-flex max-w-full overflow-x-auto bg-paper-3 shadow-ink-sm', className)}>
      {options.map((o, i) => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            'focus-ring px-3 py-1.5 font-display text-[11px] whitespace-nowrap uppercase transition-colors sm:text-xs',
            i > 0 && 'border-l-2 border-ink',
            value === o.value ? 'bg-ink text-paper' : 'hover:bg-paper-2',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Toggle                                                              */
/* ------------------------------------------------------------------ */
export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="focus-ring flex w-full items-center justify-between gap-3 py-1 text-left"
    >
      <span>{label}</span>
      <span
        className={cn(
          'relative h-7 w-13 shrink-0 rounded-full border-2 border-ink transition-colors',
          checked ? 'bg-mint' : 'bg-paper-2 hatch',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full border-2 border-ink bg-paper-3 transition-[left]',
            checked ? 'left-[26px]' : 'left-0.5',
          )}
        />
      </span>
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Slider                                                              */
/* ------------------------------------------------------------------ */
export function Slider({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <div className="flex justify-between">
        <span>{label}</span>
        <span className="tabular-nums text-ink-soft">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-[var(--crimson)]"
      />
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Modal                                                               */
/* ------------------------------------------------------------------ */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn('sk shadow-ink-lg anim-rise relative max-h-[90vh] w-full max-w-lg overflow-y-auto bg-paper-3 p-5 scroll-sk', className)}>
        <span className="tape -top-3 left-8 -rotate-6" aria-hidden />
        <div className="mb-4 flex items-start justify-between gap-4">
          <h2 className="font-display text-xl uppercase">{title}</h2>
          <IconButton aria-label="Đóng" onClick={onClose} className="h-9 w-9">
            <X size={18} strokeWidth={3} />
          </IconButton>
        </div>
        {children}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Comic burst ("BỐP!")                                                */
/* ------------------------------------------------------------------ */
export function Burst({
  text,
  color = 'var(--marker)',
  className,
  size,
}: {
  text: string;
  color?: string;
  className?: string;
  /** px; omit to size with CSS */
  size?: number;
}) {
  const pts = Array.from({ length: 24 }, (_, i) => {
    const a = (i / 24) * Math.PI * 2;
    const r = i % 2 ? 34 : 48 + ((i * 7) % 5);
    return `${50 + Math.cos(a) * r},${50 + Math.sin(a) * r * 0.78}`;
  }).join(' ');
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} className={className} aria-label={text} role="img">
      <polygon points={pts} fill={color} stroke="var(--ink)" strokeWidth="3" strokeLinejoin="round" />
      <text
        x="50"
        y="57"
        textAnchor="middle"
        fontFamily="Bungee, Impact, sans-serif"
        fontSize={text.length > 5 ? 13 : 18}
        fill="var(--ink)"
      >
        {text}
      </text>
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Avatar head (small portrait used in lists)                          */
/* ------------------------------------------------------------------ */
export function Head({ color, size = 34, className }: { color: string; size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 40 40" width={size} height={size} className={className} aria-hidden>
      <circle cx="20" cy="17" r="11" fill="var(--paper-3)" stroke={color} strokeWidth="4" />
      <circle cx="23" cy="16" r="1.6" fill={color} />
      <circle cx="28" cy="16" r="1.6" fill={color} />
      <line x1="20" y1="28" x2="20" y2="40" stroke={color} strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Doodle decorations                                                  */
/* ------------------------------------------------------------------ */
export function Scribble({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 20" className={className} preserveAspectRatio="none" aria-hidden>
      <path
        d="M2 12 C 30 4, 50 18, 80 9 S 130 16, 160 8 S 190 12, 198 9"
        fill="none"
        stroke="var(--crimson)"
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function Star({ className, color = 'var(--marker)' }: { className?: string; color?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M20 3 L24 15 L37 15 L26.5 23 L30.5 36 L20 28 L9.5 36 L13.5 23 L3 15 L16 15 Z"
        fill={color}
        stroke="var(--ink)"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

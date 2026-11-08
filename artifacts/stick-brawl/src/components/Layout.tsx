import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { Coins, Moon, Settings as SettingsIcon, Sun, Wifi, WifiOff } from 'lucide-react';

import { Head, IconButton, Kbd, Modal, Slider, Tabs, Toggle } from '@/components/ui';
import { useStore } from '@/lib/store';
import { cn } from '@/lib/utils';
import { useNet } from '@/net/client';

const NAV = [
  { href: '/', label: 'Trang chủ' },
  { href: '/lobby', label: 'Sảnh' },
  { href: '/customize', label: 'Nhân vật' },
  { href: '/kit', label: 'UI Kit' },
];

export function Logo({ className }: { className?: string }) {
  return (
    <Link href="/" className={cn('focus-ring flex items-center gap-2', className)}>
      <span className="sk grid h-9 w-9 place-items-center bg-marker shadow-ink-sm">
        <svg viewBox="0 0 64 64" className="h-7 w-7" aria-hidden>
          <g fill="none" stroke="var(--ink)" strokeWidth="5" strokeLinecap="round">
            <circle cx="32" cy="15" r="8" fill="var(--paper-3)" />
            <path d="M32 23v20M32 29l14-6M32 29l-12 8M32 43l10 14M32 43l-9 14" />
          </g>
        </svg>
      </span>
      <span className="font-display text-lg leading-none">
        QUE <span className="text-crimson">CHIẾN</span>
      </span>
    </Link>
  );
}

export function TopBar() {
  const { profile, settings, setSettings } = useStore();
  const [location] = useLocation();
  const [open, setOpen] = useState(false);
  return (
    <>
      <header className="sticky top-0 z-40 border-b-[2.5px] border-ink bg-paper/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2.5">
          <Logo />
          <nav className="ml-4 hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
            {NAV.map((n) => {
              const active = n.href === '/' ? location === '/' : location.startsWith(n.href);
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'focus-ring rounded-md px-3 py-1 text-lg transition-colors',
                    active ? 'hl font-bold' : 'hover:text-crimson',
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <NetBadge />
            <span className="sk hidden items-center gap-1.5 bg-paper-3 px-2.5 py-1 sm:inline-flex">
              <Coins size={16} className="text-marker" strokeWidth={3} />
              <span className="tabular-nums">{profile.coins.toLocaleString('vi-VN')}</span>
            </span>
            <Link href="/customize" className="sk focus-ring flex items-center gap-1.5 bg-paper-3 py-0.5 pr-3 pl-1">
              <Head color={profile.color} size={28} />
              <span className="hidden max-w-28 truncate sm:inline">{profile.name}</span>
              <span className="font-display text-[10px] text-ink-soft">Lv{profile.level}</span>
            </Link>
            <IconButton
              aria-label={settings.theme === 'paper' ? 'Chuyển sang bảng đen' : 'Chuyển sang giấy'}
              onClick={() => setSettings({ theme: settings.theme === 'paper' ? 'chalk' : 'paper' })}
            >
              {settings.theme === 'paper' ? <Moon size={18} strokeWidth={2.5} /> : <Sun size={18} strokeWidth={2.5} />}
            </IconButton>
            <IconButton aria-label="Cài đặt" onClick={() => setOpen(true)}>
              <SettingsIcon size={18} strokeWidth={2.5} />
            </IconButton>
          </div>
        </div>
        <nav className="flex justify-around border-t-2 border-ink/20 md:hidden" aria-label="Điều hướng">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className={cn('px-2 py-1.5 text-base', (n.href === '/' ? location === '/' : location.startsWith(n.href)) && 'hl')}
            >
              {n.label}
            </Link>
          ))}
        </nav>
      </header>
      <SettingsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <>
      <TopBar />
      <main className={cn('mx-auto max-w-6xl px-4 pt-6 pb-16 sm:pl-[72px]', className)}>{children}</main>
    </>
  );
}

export function SettingsModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { settings, setSettings } = useStore();
  return (
    <Modal open={open} onClose={onClose} title="Cài đặt">
      <div className="space-y-5">
        <div>
          <h3 className="mb-2 font-display text-xs uppercase text-ink-soft">Giao diện</h3>
          <Tabs
            value={settings.theme}
            onChange={(theme) => setSettings({ theme })}
            options={[
              { value: 'paper', label: 'Giấy vở' },
              { value: 'chalk', label: 'Bảng đen' },
            ]}
          />
        </div>
        <div className="space-y-3">
          <h3 className="font-display text-xs uppercase text-ink-soft">Âm thanh</h3>
          <Slider label="Nhạc nền" value={settings.music} onChange={(music) => setSettings({ music })} />
          <Slider label="Hiệu ứng" value={settings.sfx} onChange={(sfx) => setSettings({ sfx })} />
        </div>
        <div>
          <h3 className="mb-2 font-display text-xs uppercase text-ink-soft">Đồ hoạ</h3>
          <Tabs
            value={settings.quality}
            onChange={(quality) => setSettings({ quality })}
            options={[
              { value: 'low', label: 'Thấp' },
              { value: 'mid', label: 'Vừa' },
              { value: 'high', label: 'Cao' },
            ]}
          />
          <div className="mt-2">
            <Toggle label="Rung màn hình khi trúng đòn" checked={settings.shake} onChange={(shake) => setSettings({ shake })} />
            <Toggle
              label="Hiện chữ sát thương"
              checked={settings.damageNumbers}
              onChange={(damageNumbers) => setSettings({ damageNumbers })}
            />
          </div>
        </div>
        <div>
          <h3 className="mb-2 font-display text-xs uppercase text-ink-soft">Phím điều khiển</h3>
          <ControlsList />
        </div>
      </div>
    </Modal>
  );
}

export const CONTROLS: [string[], string][] = [
  [['A', 'D'], 'Di chuyển'],
  [['W', 'Space'], 'Nhảy'],
  [['J'], 'Đấm'],
  [['K'], 'Đá'],
  [['L'], 'Đỡ đòn'],
  [['Q'], 'Tuyệt chiêu (đầy nộ)'],
  [['Tab'], 'Bảng điểm'],
  [['Esc'], 'Tạm dừng'],
];

export function ControlsList() {
  return (
    <ul className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
      {CONTROLS.map(([keys, label]) => (
        <li key={label} className="flex items-center justify-between gap-2">
          <span>{label}</span>
          <span className="flex gap-1">
            {keys.map((k) => (
              <Kbd key={k}>{k}</Kbd>
            ))}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function NetBadge() {
  const status = useNet((s) => s.status);
  const ping = useNet((s) => s.ping);
  const online = status === 'open';
  return (
    <span
      className={cn('sk inline-flex items-center gap-1 px-2 py-1 text-sm', online ? 'bg-paper-3' : 'bg-crimson text-on-accent')}
      title={online ? 'Đã kết nối máy chủ' : 'Chưa kết nối máy chủ'}
    >
      {online ? <Wifi size={15} strokeWidth={3} className="text-mint" /> : <WifiOff size={15} strokeWidth={3} />}
      <span className="hidden tabular-nums lg:inline">{online ? (ping != null ? `${ping}ms` : 'Online') : status === 'connecting' ? 'Đang nối…' : 'Offline'}</span>
    </span>
  );
}

/** Shows server error messages for a few seconds. */
export function Toasts() {
  const error = useNet((s) => s.error);
  const [shown, setShown] = useState<typeof error>(null);
  useEffect(() => {
    if (!error) return;
    setShown(error);
    const t = setTimeout(() => setShown(null), 3200);
    return () => clearTimeout(t);
  }, [error]);
  if (!shown) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4" role="status" aria-live="polite">
      <div key={shown.at} className="sk shadow-ink anim-rise bg-marker px-4 py-2 text-lg text-on-marker">
        {shown.message}
      </div>
    </div>
  );
}

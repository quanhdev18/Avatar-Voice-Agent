import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { BookOpen, History, LayoutDashboard, Video } from 'lucide-react';
import { Brand } from '@/pages/landing';
import { UserMenu } from '@/lib/auth';
import { cn } from '@/lib/utils';

const NAV = [
  { href: '/dashboard', label: 'Tổng quan', icon: LayoutDashboard },
  { href: '/lessons', label: 'Bài học', icon: Video },
  { href: '/notebook', label: 'Sổ tay', icon: BookOpen },
  { href: '/history', label: 'Lịch sử', icon: History },
];

export function AppShell({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return (
    <div className="min-h-screen bg-background pb-20 text-foreground md:pb-0">
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/dashboard" className="shrink-0"><Brand compact /></Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Điều hướng chính">
            {NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition hover:bg-secondary hover:text-foreground',
                  location.startsWith(href) && 'bg-secondary text-foreground',
                )}
                data-testid={`nav-${href.slice(1)}`}
              >
                <Icon size={16} /> {label}
              </Link>
            ))}
          </nav>
          <UserMenu />
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6 md:py-10">{children}</main>
      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-background/95 backdrop-blur md:hidden" aria-label="Điều hướng">
        {NAV.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground',
              location.startsWith(href) && 'text-primary',
            )}
          >
            <Icon size={20} /> {label}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
      <div>
        <p className="mono text-[11px] tracking-[0.18em] text-muted-foreground">{eyebrow}</p>
        <h1 className="serif mt-1 text-4xl leading-tight md:text-5xl">{title}</h1>
      </div>
      {children}
    </div>
  );
}

export function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m ? `${m} phút ${s.toString().padStart(2, '0')}s` : `${s}s`;
}

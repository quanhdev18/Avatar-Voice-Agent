import { useState, type ReactNode } from 'react';
import { Check, Dices } from 'lucide-react';

import { Page } from '@/components/Layout';
import { ACCESSORIES, POSES, StickFigure, WEAPONS, type Pose } from '@/components/StickFigure';
import { Badge, Bar, Button, Panel, Tabs } from '@/components/ui';
import { ACCESSORY_LABEL, WEAPON_LABEL, WEAPON_STATS } from '@/lib/mock';
import { FIGHTER_COLORS, useStore } from '@/lib/store';
import { cn } from '@/lib/utils';

const POSE_LABEL: Record<Pose, string> = {
  idle: 'Thủ thế',
  run: 'Chạy',
  punch: 'Đấm',
  kick: 'Đá',
  jump: 'Nhảy',
  block: 'Đỡ',
  hurt: 'Trúng đòn',
  ko: 'Gục',
  victory: 'Ăn mừng',
  taunt: 'Khiêu khích',
};

type Tab = 'color' | 'accessory' | 'weapon';

export default function Customize() {
  const { profile, setProfile } = useStore();
  const [pose, setPose] = useState<Pose>('idle');
  const [tab, setTab] = useState<Tab>('color');
  const [name, setName] = useState(profile.name);
  const stats = WEAPON_STATS[profile.weapon];

  const randomize = () =>
    setProfile({
      color: FIGHTER_COLORS[Math.floor(Math.random() * FIGHTER_COLORS.length)].value,
      accessory: ACCESSORIES[Math.floor(Math.random() * ACCESSORIES.length)],
      weapon: WEAPONS[Math.floor(Math.random() * WEAPONS.length)],
    });

  return (
    <Page>
      <h1 className="font-display text-4xl">Nhân vật</h1>
      <p className="text-lg text-ink-soft">Vẽ lại người que của bạn. Mọi thay đổi được lưu tự động.</p>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_1.1fr]">
        {/* Preview */}
        <div>
          <div className="sk shadow-ink-lg relative overflow-hidden bg-paper-3">
            <span className="tape -top-1 left-1/2 -translate-x-1/2 -rotate-2" aria-hidden />
            <div className="flex items-center justify-between px-4 pt-5">
              <div className="min-w-0">
                <div className="truncate font-display text-xl">{profile.name}</div>
                <div className="text-ink-soft">Cấp {profile.level}</div>
              </div>
              <Button size="sm" variant="yellow" onClick={randomize}>
                <Dices size={16} strokeWidth={3} /> Ngẫu nhiên
              </Button>
            </div>
            <div className="mx-auto aspect-square w-full max-w-[380px]">
              <StickFigure
                pose={pose}
                color={profile.color}
                accessory={profile.accessory}
                weapon={profile.weapon}
                stroke={4.5}
                title={`Người que của ${profile.name}`}
              />
            </div>
            <div className="border-t-[2.5px] border-ink bg-paper-2 p-3">
              <div className="flex flex-wrap gap-2">
                {POSES.map((p) => (
                  <button
                    key={p}
                    onClick={() => setPose(p)}
                    className={cn(
                      'focus-ring rounded-[8px_3px_9px_3px] border-2 border-ink px-2 py-0.5 text-sm transition-colors',
                      pose === p ? 'bg-ink text-paper' : 'bg-paper-3 hover:bg-marker hover:text-on-marker',
                    )}
                  >
                    {POSE_LABEL[p]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-6">
          <Panel title="Tên hiển thị">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (name.trim()) setProfile({ name: name.trim().slice(0, 16) });
              }}
            >
              <input className="input-sk" value={name} onChange={(e) => setName(e.target.value)} maxLength={16} />
              <Button type="submit" variant="blue" disabled={!name.trim() || name.trim() === profile.name}>
                Lưu
              </Button>
            </form>
          </Panel>

          <div>
            <Tabs<Tab>
              value={tab}
              onChange={setTab}
              options={[
                { value: 'color', label: 'Màu mực' },
                { value: 'accessory', label: 'Phụ kiện' },
                { value: 'weapon', label: 'Vũ khí' },
              ]}
            />
            <Panel className="mt-3">
              {tab === 'color' && (
                <div className="grid grid-cols-4 gap-3">
                  {FIGHTER_COLORS.map((c) => (
                    <button
                      key={c.value}
                      onClick={() => setProfile({ color: c.value })}
                      className={cn(
                        'sk focus-ring flex flex-col items-center gap-1 bg-paper p-2 transition-transform',
                        profile.color === c.value && 'shadow-ink -translate-y-1',
                      )}
                      aria-pressed={profile.color === c.value}
                    >
                      <span className="relative grid h-10 w-10 place-items-center rounded-full border-[2.5px] border-ink" style={{ background: c.value }}>
                        {profile.color === c.value && <Check size={20} strokeWidth={4} className="text-paper" />}
                      </span>
                      <span className="text-sm">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {tab === 'accessory' && (
                <div className="grid grid-cols-3 gap-3 sm:grid-cols-4">
                  {ACCESSORIES.map((a) => (
                    <ItemCard key={a} active={profile.accessory === a} onClick={() => setProfile({ accessory: a })} label={ACCESSORY_LABEL[a]} locked={a === 'halo' && profile.level < 10}>
                      <StickFigure accessory={a} color={profile.color} pose="idle" className="h-20 w-20" />
                    </ItemCard>
                  ))}
                </div>
              )}
              {tab === 'weapon' && (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {WEAPONS.map((w) => (
                    <ItemCard key={w} active={profile.weapon === w} onClick={() => setProfile({ weapon: w })} label={WEAPON_LABEL[w]}>
                      <StickFigure weapon={w} color={profile.color} pose="block" className="h-20 w-20" />
                    </ItemCard>
                  ))}
                </div>
              )}
            </Panel>
          </div>

          <Panel title="Chỉ số" tone="paper-2" action={<Badge tone="yellow">{WEAPON_LABEL[profile.weapon]}</Badge>}>
            <div className="space-y-2">
              <Bar label="Sát thương" value={stats.dmg} max={5} segments={5} color="var(--crimson)" />
              <Bar label="Tốc độ" value={stats.speed} max={5} segments={5} color="var(--cobalt)" />
              <Bar label="Tầm đánh" value={stats.reach} max={5} segments={5} color="var(--mint)" />
            </div>
          </Panel>
        </div>
      </div>
    </Page>
  );
}

function ItemCard({
  active,
  onClick,
  label,
  children,
  locked = false,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: ReactNode;
  locked?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={locked}
      aria-pressed={active}
      className={cn(
        'sk focus-ring relative flex flex-col items-center bg-paper p-1.5 transition-transform disabled:cursor-not-allowed',
        active ? 'shadow-ink -translate-y-1 bg-marker/30' : 'hover:bg-paper-2',
      )}
    >
      <span className={cn(locked && 'opacity-30 grayscale')}>{children}</span>
      <span className="text-sm leading-tight">{label}</span>
      {locked && <Badge tone="ink" className="absolute top-1 right-1 text-[11px]">Lv10</Badge>}
      {active && (
        <span className="absolute -top-2 -right-2 grid h-6 w-6 place-items-center rounded-full border-2 border-ink bg-mint">
          <Check size={14} strokeWidth={4} className="text-on-accent" />
        </span>
      )}
    </button>
  );
}

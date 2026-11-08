import { useEffect, useState } from 'react';
import { Link, useLocation } from 'wouter';
import { Swords, Users, Shirt, Trophy, Zap, Target } from 'lucide-react';

import { Page } from '@/components/Layout';
import { StickFigure, type Pose } from '@/components/StickFigure';
import { Badge, Bar, Burst, Button, Panel, Scribble, Star } from '@/components/ui';
import { useStore } from '@/lib/store';

const DUEL: { a: Pose; b: Pose; fx?: string }[] = [
  { a: 'idle', b: 'idle' },
  { a: 'punch', b: 'hurt', fx: 'BỐP!' },
  { a: 'block', b: 'kick', fx: 'CHẶN!' },
  { a: 'taunt', b: 'idle' },
  { a: 'kick', b: 'hurt', fx: 'HỰ!' },
  { a: 'jump', b: 'block' },
  { a: 'punch', b: 'ko', fx: 'K.O!' },
  { a: 'victory', b: 'ko' },
];

export default function Home() {
  const { profile } = useStore();
  const [, nav] = useLocation();
  const [step, setStep] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % DUEL.length), 1100);
    return () => clearInterval(id);
  }, []);
  const d = DUEL[step];

  return (
    <Page>
      <div className="grid items-center gap-8 lg:grid-cols-[1.1fr_1fr]">
        {/* Title + menu */}
        <div className="anim-rise">
          <div className="mb-3 flex flex-wrap gap-2">
            <Badge tone="green">● 1.284 người đang chơi</Badge>
            <Badge tone="yellow">Mùa 1 · Trang vở</Badge>
          </div>
          <h1 className="font-display text-6xl leading-[1.08] text-paper-3 title-stroke sm:text-7xl lg:text-8xl">
            QUE
            <br />
            <span className="text-crimson">CHIẾN</span>
          </h1>
          <Scribble className="mt-1 h-4 w-64" />
          <p className="mt-4 max-w-md text-xl text-ink-soft">
            Người que vẽ tay, đấm đá loạn xạ. Lập phòng, gọi bạn bè, và xem ai là người cuối cùng còn đứng trên trang vở.
          </p>

          <div className="mt-7 grid max-w-md gap-4">
            <Button variant="red" size="xl" onClick={() => nav('/play')} className="w-full">
              <Swords size={28} strokeWidth={3} /> Chơi ngay
            </Button>
            <div className="grid grid-cols-2 gap-4">
              <Button variant="blue" size="lg" onClick={() => nav('/lobby')}>
                <Users size={20} strokeWidth={3} /> Sảnh
              </Button>
              <Button variant="yellow" size="lg" onClick={() => nav('/customize')}>
                <Shirt size={20} strokeWidth={3} /> Nhân vật
              </Button>
            </div>
          </div>
        </div>

        {/* Animated duel */}
        <div className="relative">
          <div className="sk shadow-ink-lg relative aspect-[5/4] overflow-hidden bg-paper-3">
            <span className="tape -top-1 left-10 -rotate-6" aria-hidden />
            <span className="tape -top-1 right-10 rotate-6" aria-hidden />
            {/* doodle sky */}
            <svg viewBox="0 0 500 400" className="absolute inset-0 h-full w-full" aria-hidden>
              <circle cx="420" cy="70" r="30" fill="var(--marker)" stroke="var(--ink)" strokeWidth="3" />
              <path d="M60 80 q 20 -25 45 -5 q 20 -20 40 2 q 15 18 -10 22 h -70 q -25 -5 -5 -19z" fill="var(--paper-3)" stroke="var(--ink)" strokeWidth="3" />
              <path d="M250 50 q 15 -18 35 -4 q 15 -14 30 2 q 10 14 -8 16 h -52 q -18 -4 -5 -14z" fill="var(--paper-3)" stroke="var(--ink)" strokeWidth="3" />
              {/* ground platform */}
              <path d="M30 330 Q 250 318 470 330 L 455 352 Q 250 343 45 352 Z" fill="var(--paper-2)" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round" />
              <path d="M70 352 l -10 30 M140 350 l -5 25 M360 350 l 6 28 M430 352 l 10 22" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <div className="absolute bottom-[17%] left-[14%] w-[38%]">
              <StickFigure pose={d.a} color={profile.color} accessory={profile.accessory} weapon={profile.weapon} />
            </div>
            <div className="absolute right-[12%] bottom-[17%] w-[38%]">
              <StickFigure pose={d.b} facing={-1} color="var(--cobalt)" accessory="cap" />
            </div>
            {d.fx && (
              <div key={step} className="anim-pop absolute top-[18%] left-1/2 -translate-x-1/2">
                <Burst text={d.fx} color={d.fx === 'CHẶN!' ? 'var(--paper-3)' : 'var(--marker)'} size={130} />
              </div>
            )}
            {/* mini HUD */}
            <div className="absolute inset-x-3 top-3 flex items-start justify-between gap-6">
              <div className="w-2/5">
                <div className="truncate font-display text-[11px]">{profile.name}</div>
                <Bar value={step >= 6 ? 100 : 100 - step * 4} color="var(--mint)" height="h-3" />
              </div>
              <div className="w-2/5 text-right">
                <div className="truncate font-display text-[11px]">KhoaBu</div>
                <Bar value={Math.max(0, 100 - (step >= 1 ? 30 : 0) - (step >= 4 ? 35 : 0) - (step >= 6 ? 35 : 0))} color="var(--crimson)" height="h-3" />
              </div>
            </div>
          </div>
          <Star className="anim-wobble absolute -top-6 -right-4 h-14 w-14" />
          <Star className="anim-wobble absolute -bottom-5 -left-5 h-10 w-10" color="var(--crimson)" />
        </div>
      </div>

      {/* Info strip */}
      <div className="mt-14 grid gap-6 md:grid-cols-3">
        <Panel title={<span className="flex items-center gap-2"><Target size={18} /> Nhiệm vụ hôm nay</span>} tape>
          <ul className="space-y-3">
            {[
              ['Hạ gục 10 đối thủ', 7, 10],
              ['Thắng 3 trận đồng đội', 1, 3],
              ['Tung 5 tuyệt chiêu', 5, 5],
            ].map(([label, v, m]) => (
              <li key={label as string}>
                <Bar label={label as string} value={v as number} max={m as number} showValue segments={m as number} color={v === m ? 'var(--mint)' : 'var(--marker)'} height="h-3" />
              </li>
            ))}
          </ul>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Trophy size={18} /> Bảng xếp hạng</span>} tone="paper-2">
          <ol className="space-y-1.5">
            {['SieuNhanQue', 'TrumQue', 'ThayDo', 'que_hn', 'MeoMeo'].map((n, i) => (
              <li key={n} className="flex items-center gap-2">
                <span className={`grid h-7 w-7 place-items-center rounded-full border-2 border-ink font-display text-xs ${i === 0 ? 'bg-marker text-on-marker' : 'bg-paper-3'}`}>
                  {i + 1}
                </span>
                <span className="flex-1 truncate">{n}</span>
                <span className="tabular-nums text-ink-soft">{(2480 - i * 137).toLocaleString('vi-VN')}</span>
              </li>
            ))}
          </ol>
        </Panel>
        <Panel title={<span className="flex items-center gap-2"><Zap size={18} /> Có gì mới</span>}>
          <div className="space-y-2">
            <p>
              <span className="hl">Bản đồ mới:</span> Núi lửa — dung nham dâng dần, đứng yên là chết.
            </p>
            <p>Thêm vũ khí <b>Búa</b>: chậm nhưng một phát bay màu.</p>
            <Link href="/kit" className="inline-block text-cobalt underline decoration-wavy underline-offset-4">
              Xem bộ UI Kit →
            </Link>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

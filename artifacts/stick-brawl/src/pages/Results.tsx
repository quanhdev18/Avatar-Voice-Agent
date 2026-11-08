import { useLocation } from 'wouter';
import { RotateCcw, Users, Star as StarIcon } from 'lucide-react';

import { Page } from '@/components/Layout';
import { StickFigure } from '@/components/StickFigure';
import { Badge, Bar, Button, Panel, Star } from '@/components/ui';
import { BOTS } from '@/lib/mock';
import { getLastResult, useStore, type MatchResult } from '@/lib/store';
import { cn, formatTime } from '@/lib/utils';

function sampleResult(name: string, color: string): MatchResult {
  const teams = ['red', 'red', 'red', 'blue', 'blue', 'blue'] as const;
  const kos = [4, 3, 3, 2, 2, 1];
  return {
    mode: 'team',
    winner: 'red',
    score: { red: 10, blue: 5 },
    durationSec: 142,
    players: [{ name, color, accessory: 'headband' as const, weapon: 'none' as const }, ...BOTS.slice(0, 5)].map((p, i) => ({
      ...p,
      id: `p${i}`,
      team: teams[i]!,
      kos: kos[i]!,
      falls: [1, 2, 2, 4, 3, 3][i]!,
      damage: [412, 355, 330, 260, 240, 190][i]!,
      you: i === 0,
    })),
  };
}

export default function Results() {
  const [, nav] = useLocation();
  const { profile } = useStore();
  const r = getLastResult() ?? sampleResult(profile.name, profile.color);
  const ranked = [...r.players].sort((a, b) => b.kos - a.kos || b.damage - a.damage);
  const mvp = ranked[0];
  const podium = [ranked[1], ranked[0], ranked[2]].filter(Boolean);
  const me = r.players.find((p) => p.you);
  const won = !!me && (r.mode === 'team' ? r.winner === me.team : r.winner === me.id);
  const winnerName = r.players.find((p) => p.id === r.winner)?.name;
  const online = !!r.roomId;
  const xpGain = 120 + (me?.kos ?? 0) * 25 + (won ? 80 : 0);
  const coinGain = 40 + (me?.kos ?? 0) * 10 + (won ? 50 : 0);

  return (
    <Page>
      <div className="text-center">
        <Badge tone={r.winner === 'red' ? 'red' : r.winner === 'blue' ? 'blue' : 'yellow'}>
          Trận đấu · {formatTime(r.durationSec)}
        </Badge>
        <h1
          className={cn(
            'mt-3 font-display text-6xl title-stroke sm:text-7xl',
            r.winner === 'draw' ? 'text-marker' : won ? 'text-mint' : 'text-crimson',
          )}
        >
          {r.winner === 'draw' ? 'HOÀ!' : won ? 'CHIẾN THẮNG!' : 'THUA RỒI…'}
        </h1>
        {r.mode === 'team' ? (
          <div className="mt-3 inline-flex items-center gap-3 font-display text-3xl">
            <span className="text-crimson">{r.score.red ?? 0}</span>
            <span className="text-ink-soft">–</span>
            <span className="text-cobalt">{r.score.blue ?? 0}</span>
          </div>
        ) : (
          <p className="mt-3 text-xl">{winnerName ? <>Người thắng hỗn chiến: <b className="hl">{winnerName}</b></> : 'Không ai vượt lên được'}</p>
        )}
      </div>

      {/* podium */}
      <div className="mx-auto mt-6 grid max-w-2xl grid-cols-3 items-end gap-3">
        {podium.map((p) => {
          const place = ranked.indexOf(p) + 1;
          const h = place === 1 ? 'h-36' : place === 2 ? 'h-24' : 'h-16';
          return (
            <div key={p.name} className="flex flex-col items-center">
              <div className="relative w-full max-w-[180px]">
                {place === 1 && <Star className="anim-wobble absolute -top-2 right-2 h-10 w-10" />}
                <StickFigure
                  color={p.color}
                  accessory={place === 1 ? 'crown' : p.accessory}
                  weapon={p.weapon}
                  pose={place === 1 ? 'victory' : place === 2 ? 'taunt' : 'idle'}
                  phase={place}
                />
              </div>
              <div className="w-full truncate text-center font-bold">{p.name}</div>
              <div
                className={cn(
                  'sk mt-1 grid w-full place-items-center font-display text-3xl shadow-ink',
                  h,
                  place === 1 ? 'bg-marker text-on-marker' : place === 2 ? 'bg-paper-3' : 'bg-paper-2',
                )}
              >
                {place}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-10 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Panel title="Thống kê" className="overflow-x-auto">
          <table className="w-full min-w-[420px]">
            <thead>
              <tr className="font-display text-xs text-ink-soft">
                <th className="py-1 text-left">#</th>
                <th className="text-left">Người chơi</th>
                <th>K.O</th>
                <th>Gục</th>
                <th>Sát thương</th>
              </tr>
            </thead>
            <tbody>
              {ranked.map((p, i) => (
                <tr key={p.name} className={cn('border-t-2 border-dashed border-ink/20', p.you && 'bg-marker/25')}>
                  <td className="py-1.5 font-display text-sm">{i + 1}</td>
                  <td>
                    <span className="flex items-center gap-2">
                      <span
                        className="h-3 w-3 shrink-0 rounded-full border-2 border-ink"
                        style={{ background: r.mode === 'ffa' ? p.color : p.team === 'red' ? 'var(--crimson)' : 'var(--cobalt)' }}
                      />
                      <span className="truncate">{p.name}</span>
                      {p === mvp && <Badge tone="yellow" className="text-xs">MVP</Badge>}
                      {p.you && <Badge className="text-xs">Bạn</Badge>}
                    </span>
                  </td>
                  <td className="text-center tabular-nums">{p.kos}</td>
                  <td className="text-center tabular-nums">{p.falls}</td>
                  <td className="text-center tabular-nums">{p.damage}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>

        <div className="space-y-6">
          <Panel title="Phần thưởng" tape tone="paper-2">
            <div className="flex flex-wrap gap-3">
              <Badge tone="blue" className="text-base">
                <StarIcon size={14} strokeWidth={3} /> +{xpGain} XP
              </Badge>
              <Badge tone="yellow" className="text-base">
                🪙 +{coinGain} xu
              </Badge>
            </div>
            <Bar className="mt-4" label={`Cấp ${profile.level} → ${profile.level + 1}`} value={Math.min(1000, profile.xp + xpGain)} max={1000} showValue color="var(--cobalt)" />
          </Panel>
          <div className="grid grid-cols-2 gap-4">
            <Button variant="red" size="lg" onClick={() => nav(online ? `/room/${r.roomId}` : '/play')}>
              <RotateCcw size={18} strokeWidth={3} /> {online ? 'Về phòng' : 'Đấu lại'}
            </Button>
            <Button variant="blue" size="lg" onClick={() => nav('/lobby')}>
              <Users size={18} strokeWidth={3} /> Về sảnh
            </Button>
          </div>
        </div>
      </div>
    </Page>
  );
}

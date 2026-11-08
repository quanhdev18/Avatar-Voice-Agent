import { Link } from 'wouter';
import { ArrowRight, BookOpen, Clock3, Flame, GraduationCap, Layers, Sparkles, Target } from 'lucide-react';
import { useGetDashboard } from '@workspace/api-client-react';
import { AppShell, PageTitle, formatDuration } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';

function Stat({ icon: Icon, label, value, hint, tone = 'primary' }: { icon: typeof Flame; label: string; value: string | number; hint?: string; tone?: 'primary' | 'accent' }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-sm)]">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <span className={`grid size-8 place-items-center rounded-full ${tone === 'accent' ? 'bg-accent/20 text-[hsl(14_48%_42%)]' : 'bg-primary/10 text-primary'}`}><Icon size={16} /></span>
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export default function DashboardPage() {
  const { data, isLoading, isError, refetch } = useGetDashboard();

  return (
    <AppShell>
      <PageTitle eyebrow="BẢNG TIẾN ĐỘ" title={<>おかえり！<span className="text-muted-foreground"> Chào mừng trở lại.</span></>} />
      {isLoading && <div className="grid gap-4 md:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}</div>}
      {isError && <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-sm">Không tải được dữ liệu. <button className="underline" onClick={() => refetch()}>Thử lại</button></div>}
      {data && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
            <Stat icon={GraduationCap} label="Trình độ" value={`JLPT ${data.level}`} hint={`${data.completedLessons}/${data.totalLessons} bài hoàn thành`} />
            <Stat icon={Flame} label="Chuỗi ngày học" value={`${data.streakDays} ngày`} hint={data.streakDays ? 'Giữ lửa nhé!' : 'Học hôm nay để bắt đầu chuỗi'} tone="accent" />
            <Stat icon={Layers} label="Cần ôn hôm nay" value={data.dueReviewCount} hint={`${data.notebookCount} mục trong sổ tay`} />
            <Stat icon={Clock3} label="Hôm nay đã học" value={`${Math.round(data.todaySecondsUsed / 60)}/${data.dailyMinuteLimit}′`} hint="Giới hạn phút/ngày" tone="accent" />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
            <section className="relative overflow-hidden rounded-3xl bg-[hsl(164_24%_20%)] p-6 text-[hsl(42_37%_96%)] md:p-8">
              <div className="pointer-events-none absolute -right-6 -top-10 select-none text-[11rem] leading-none opacity-[0.07]">学</div>
              <p className="mono text-[11px] tracking-[0.18em] opacity-70">BÀI TIẾP THEO</p>
              {data.nextLesson ? (
                <>
                  <h2 className="serif mt-2 text-3xl md:text-4xl">{data.nextLesson.titleVi}</h2>
                  <p className="mt-1 text-lg opacity-80">{data.nextLesson.title} · Bài {data.nextLesson.order}</p>
                  <div className="mt-5 max-w-sm">
                    <Progress value={(data.completedLessons / Math.max(1, data.totalLessons)) * 100} className="h-1.5 bg-white/15" />
                    <p className="mt-2 text-xs opacity-70">Lộ trình N5: {data.completedLessons}/{data.totalLessons} bài</p>
                  </div>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href={`/classroom/${data.nextLesson.id}`} className="inline-flex items-center gap-2 rounded-full bg-[hsl(42_37%_96%)] px-5 py-3 font-medium text-[hsl(164_24%_20%)]" data-testid="button-start-next-lesson">
                      Vào phòng học <ArrowRight size={16} />
                    </Link>
                    <Link href="/lessons" className="inline-flex items-center gap-2 rounded-full border border-white/25 px-5 py-3 text-sm">Chọn bài khác</Link>
                  </div>
                </>
              ) : (
                <h2 className="serif mt-2 text-3xl">Bạn đã hoàn thành 10 bài N5 đầu tiên! 🎉</h2>
              )}
            </section>

            <section className="flex flex-col rounded-3xl border bg-card p-6">
              <div className="flex items-center gap-2 text-sm font-medium"><Target size={16} className="text-primary" /> Ôn tập SRS</div>
              <p className="mt-3 text-4xl font-semibold">{data.dueReviewCount}<span className="ml-1 text-base font-normal text-muted-foreground">thẻ đến hạn</span></p>
              <p className="mt-2 text-sm text-muted-foreground">Ôn đúng lúc sắp quên giúp nhớ lâu hơn (thuật toán SM-2).</p>
              {data.weakPoints.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-medium text-muted-foreground">Điểm yếu cần chú ý</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">{data.weakPoints.slice(0, 5).map((w) => <span key={w} className="rounded-full bg-accent/15 px-2.5 py-1 text-xs">{w}</span>)}</div>
                </div>
              )}
              <Link href="/notebook?review=1" className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 pt-3 text-sm font-medium text-primary-foreground disabled:opacity-50" data-testid="button-review-now">
                <BookOpen size={16} /> {data.dueReviewCount ? 'Ôn ngay' : 'Mở sổ tay'}
              </Link>
            </section>
          </div>

          <section className="rounded-3xl border bg-card p-6">
            <div className="flex items-center justify-between"><h3 className="font-semibold">Buổi học gần đây</h3><Link href="/history" className="text-sm text-primary">Xem tất cả</Link></div>
            {data.recentSessions.length === 0 ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground"><Sparkles size={15} /> Chưa có buổi học nào. Buổi đầu tiên chỉ mất ~15 phút.</p>
            ) : (
              <ul className="mt-3 divide-y">
                {data.recentSessions.map((s) => (
                  <li key={s.id}>
                    <Link href={`/history/${s.id}`} className="flex items-center justify-between gap-3 py-3 text-sm hover:text-primary">
                      <span className="truncate"><b className="font-medium">{s.lessonTitle ?? s.lessonId}</b><span className="ml-2 text-muted-foreground">{new Date(s.startedAt).toLocaleDateString('vi-VN')}</span></span>
                      <span className="shrink-0 text-muted-foreground">{formatDuration(s.durationSeconds)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

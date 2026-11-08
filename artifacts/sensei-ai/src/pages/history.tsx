import { Link, useParams } from 'wouter';
import { AlertTriangle, ArrowLeft, Clock3, MessageSquareText } from 'lucide-react';
import { useGetSession, useListSessions, getGetSessionQueryKey } from '@workspace/api-client-react';
import { AppShell, PageTitle, formatDuration } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

function fmtClock(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function HistoryListPage() {
  const { data, isLoading } = useListSessions();
  return (
    <AppShell>
      <PageTitle eyebrow="LỊCH SỬ BUỔI HỌC" title="Nhìn lại hành trình" />
      {isLoading && <Skeleton className="h-60 rounded-2xl" />}
      {data?.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Chưa có buổi học nào được lưu.</div>}
      <div className="space-y-3">
        {data?.map((s) => (
          <Link key={s.id} href={`/history/${s.id}`} className="block rounded-2xl border bg-card p-5 transition hover:border-primary/40" data-testid={`session-${s.id}`}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-medium">{s.lessonTitle ?? s.lessonId}</h3>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {s.mode === 'demo' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">demo</span>}
                <span>{new Date(s.startedAt).toLocaleString('vi-VN')}</span>
                <span className="inline-flex items-center gap-1"><Clock3 size={12} />{formatDuration(s.durationSeconds)}</span>
              </div>
            </div>
            {s.summary && <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{s.summary}</p>}
            {s.mistakeCount > 0 && <p className="mt-2 inline-flex items-center gap-1 text-xs text-[hsl(14_48%_42%)]"><AlertTriangle size={12} />{s.mistakeCount} lỗi cần chú ý</p>}
          </Link>
        ))}
      </div>
    </AppShell>
  );
}

export function HistoryDetailPage() {
  const { sessionId = '' } = useParams<{ sessionId: string }>();
  const { data, isLoading, isError } = useGetSession(sessionId, { query: { queryKey: getGetSessionQueryKey(sessionId), enabled: Boolean(sessionId) } });
  return (
    <AppShell>
      <Link href="/history" className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={15} /> Lịch sử</Link>
      {isLoading && <Skeleton className="h-80 rounded-2xl" />}
      {isError && <p className="text-sm text-destructive">Không tìm thấy buổi học.</p>}
      {data && (
        <>
          <PageTitle eyebrow={`${new Date(data.startedAt).toLocaleString('vi-VN')} · ${formatDuration(data.durationSeconds)}`} title={data.lessonTitle ?? data.lessonId} />
          <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
            <div className="space-y-4">
              <section className="rounded-2xl border bg-card p-5">
                <h3 className="font-semibold">Tóm tắt</h3>
                <p className="mt-2 text-sm leading-relaxed">{data.summary ?? 'Chưa có tóm tắt.'}</p>
              </section>
              <section className="rounded-2xl border bg-card p-5">
                <h3 className="flex items-center gap-2 font-semibold"><AlertTriangle size={16} className="text-[hsl(14_48%_48%)]" />Lỗi hay mắc</h3>
                {data.commonMistakes.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Không ghi nhận lỗi nào. すばらしい！</p> : (
                  <ul className="mt-2 space-y-2 text-sm">{data.commonMistakes.map((m, i) => <li key={i} className="rounded-lg bg-accent/10 px-3 py-2">{m}</li>)}</ul>
                )}
              </section>
            </div>
            <section className="rounded-2xl border bg-card p-5">
              <h3 className="flex items-center gap-2 font-semibold"><MessageSquareText size={16} />Transcript</h3>
              <div className="mt-3 max-h-[60vh] space-y-2 overflow-y-auto pr-1">
                {data.transcript.length === 0 && <p className="text-sm text-muted-foreground">Không có transcript.</p>}
                {data.transcript.map((t, i) => (
                  <div key={i} className={cn('flex gap-3 text-sm', t.speaker === 'learner' && 'flex-row-reverse text-right')}>
                    <span className="mono shrink-0 pt-1 text-[10px] text-muted-foreground">{fmtClock(t.elapsedMs)}</span>
                    <p className={cn('rounded-2xl px-3.5 py-2', t.speaker === 'teacher' ? 'bg-secondary' : 'bg-primary text-primary-foreground')}>{t.text}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </>
      )}
    </AppShell>
  );
}

import { Link } from 'wouter';
import { CheckCircle2, CircleDot, Circle, ArrowRight } from 'lucide-react';
import { useListLessons } from '@workspace/api-client-react';
import { AppShell, PageTitle } from '@/components/app-shell';
import { Skeleton } from '@/components/ui/skeleton';

const STATUS = {
  completed: { icon: CheckCircle2, label: 'Đã xong', cls: 'text-primary' },
  in_progress: { icon: CircleDot, label: 'Đang học', cls: 'text-[hsl(14_48%_48%)]' },
  not_started: { icon: Circle, label: 'Chưa học', cls: 'text-muted-foreground' },
} as const;

export default function LessonsPage() {
  const { data, isLoading } = useListLessons();
  return (
    <AppShell>
      <PageTitle eyebrow="GIÁO TRÌNH JLPT N5" title="10 bài đầu tiên" />
      {isLoading && <Skeleton className="h-64 rounded-2xl" />}
      <div className="grid gap-3 md:grid-cols-2">
        {data?.map((lesson) => {
          const st = STATUS[lesson.status];
          return (
            <Link key={lesson.id} href={`/classroom/${lesson.id}`} className="group flex items-center gap-4 rounded-2xl border bg-card p-4 transition hover:border-primary/40 hover:shadow-[var(--shadow-sm)]" data-testid={`lesson-${lesson.id}`}>
              <span className="mono grid size-12 shrink-0 place-items-center rounded-xl bg-secondary text-lg">{String(lesson.order).padStart(2, '0')}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{lesson.titleVi}</span>
                <span className="block truncate text-sm text-muted-foreground">{lesson.title}</span>
              </span>
              <span className={`hidden items-center gap-1 text-xs sm:inline-flex ${st.cls}`}><st.icon size={14} /> {st.label}</span>
              <ArrowRight size={16} className="text-muted-foreground transition group-hover:translate-x-0.5 group-hover:text-primary" />
            </Link>
          );
        })}
      </div>
    </AppShell>
  );
}

import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BookOpen, Eye, Plus, RotateCcw, Sparkles } from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getListNotebookQueryKey,
  useAddNotebookItem,
  useListNotebook,
  useReviewNotebookItem,
} from '@workspace/api-client-react';
import type { NotebookItem } from '@workspace/api-client-react';
import { AppShell, PageTitle } from '@/components/app-shell';
import { Ruby } from '@/components/jp-text';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

const GRADES = [
  { quality: 1, label: 'Quên', hint: '1 ngày', cls: 'bg-destructive/10 text-destructive hover:bg-destructive/15' },
  { quality: 3, label: 'Khó', hint: 'ít ngày', cls: 'bg-accent/20 hover:bg-accent/30' },
  { quality: 4, label: 'Nhớ', hint: 'chuẩn', cls: 'bg-primary/10 text-primary hover:bg-primary/15' },
  { quality: 5, label: 'Dễ', hint: 'lâu hơn', cls: 'bg-primary text-primary-foreground hover:opacity-90' },
];

function isKanji(term: string) {
  return /[㐀-鿿]/u.test(term);
}

function Flashcards({ onDone }: { onDone: () => void }) {
  const qc = useQueryClient();
  const due = useListNotebook({ due: true });
  const review = useReviewNotebookItem();
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [reviewed, setReviewed] = useState(0);
  const cards = due.data ?? [];
  const card = cards[index];

  const grade = async (quality: number) => {
    if (!card) return;
    await review.mutateAsync({ itemId: card.id, data: { quality } });
    setReviewed((n) => n + 1);
    setRevealed(false);
    setIndex((i) => i + 1);
    void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
  };

  if (due.isLoading) return <Skeleton className="h-80 rounded-3xl" />;
  if (!card) {
    return (
      <div className="rounded-3xl border bg-card p-10 text-center">
        <Sparkles className="mx-auto text-primary" />
        <h3 className="serif mt-3 text-3xl">{reviewed ? `Xong ${reviewed} thẻ! お疲れさま。` : 'Không có thẻ nào đến hạn.'}</h3>
        <p className="mt-2 text-sm text-muted-foreground">Quay lại sau nhé — thẻ sẽ xuất hiện đúng lúc bạn sắp quên.</p>
        <button className="mt-5 rounded-full border px-4 py-2 text-sm" onClick={() => { void qc.invalidateQueries({ queryKey: getListNotebookQueryKey() }); onDone(); }}>Về sổ tay</button>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-3 flex justify-between text-xs text-muted-foreground"><span>Thẻ {index + 1}/{cards.length}</span><span className="mono uppercase">{card.type === 'vocab' ? 'Từ vựng' : 'Ngữ pháp'}</span></div>
      <button
        className="flex min-h-56 w-full md:min-h-72 flex-col items-center justify-center rounded-3xl border bg-card p-8 text-center shadow-[var(--shadow)] transition"
        onClick={() => setRevealed(true)}
        data-testid="flashcard"
      >
        <div className="text-5xl font-medium md:text-6xl" lang="ja">
          {revealed && card.data.kana && isKanji(card.term) ? <Ruby kanji={card.term} kana={card.data.kana} /> : card.term}
        </div>
        {revealed ? (
          <div className="mt-6 space-y-2">
            {card.data.romaji && <p className="mono text-sm text-muted-foreground">{card.data.romaji}</p>}
            <p className="text-xl font-medium">{card.data.meaningVi}</p>
            {card.data.example && <p className="text-sm" lang="ja">{card.data.example}</p>}
            {card.data.exampleVi && <p className="text-sm text-muted-foreground">{card.data.exampleVi}</p>}
          </div>
        ) : (
          <p className="mt-8 inline-flex items-center gap-2 text-sm text-muted-foreground"><Eye size={15} /> Nhớ nghĩa rồi chạm để lật thẻ</p>
        )}
      </button>
      {revealed && (
        <div className="mt-4 grid grid-cols-4 gap-2">
          {GRADES.map((g) => (
            <button key={g.quality} disabled={review.isPending} onClick={() => grade(g.quality)} className={cn('rounded-xl px-2 py-3 text-sm font-medium transition disabled:opacity-50', g.cls)} data-testid={`grade-${g.quality}`}>
              {g.label}<span className="block text-[11px] font-normal opacity-70">{g.hint}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItemForm() {
  const qc = useQueryClient();
  const add = useAddNotebookItem();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');
  const [kana, setKana] = useState('');
  const [meaningVi, setMeaningVi] = useState('');
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!term.trim() || !meaningVi.trim()) return;
    await add.mutateAsync({ data: { type: 'vocab', data: { term, kana: kana || undefined, meaningVi } } });
    setTerm(''); setKana(''); setMeaningVi(''); setOpen(false);
    void qc.invalidateQueries({ queryKey: getListNotebookQueryKey() });
  };
  if (!open) return <button onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm"><Plus size={15} /> Thêm từ</button>;
  return (
    <form onSubmit={submit} className="flex w-full flex-wrap gap-2 rounded-2xl border bg-card p-3">
      <input className="min-w-28 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Từ (漢字/かな)" value={term} onChange={(e) => setTerm(e.target.value)} />
      <input className="min-w-28 flex-1 rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Cách đọc" value={kana} onChange={(e) => setKana(e.target.value)} />
      <input className="min-w-40 flex-[2] rounded-lg border bg-background px-3 py-2 text-sm" placeholder="Nghĩa tiếng Việt" value={meaningVi} onChange={(e) => setMeaningVi(e.target.value)} />
      <button className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground" disabled={add.isPending}>Lưu</button>
    </form>
  );
}

export default function NotebookPage() {
  const initialReview = new URLSearchParams(window.location.search).has('review');
  const [mode, setMode] = useState<'list' | 'review'>(initialReview ? 'review' : 'list');
  const [filter, setFilter] = useState<'all' | 'vocab' | 'grammar'>('all');
  const all = useListNotebook();
  const items = useMemo(() => (all.data ?? []).filter((i: NotebookItem) => filter === 'all' || i.type === filter), [all.data, filter]);
  const dueCount = (all.data ?? []).filter((i) => new Date(i.dueAt) <= new Date()).length;

  return (
    <AppShell>
      <PageTitle eyebrow="SỔ TAY · SRS" title="Những gì bạn đã học">
        <div className="inline-flex rounded-full border bg-card p-1 text-sm">
          <button onClick={() => setMode('list')} className={cn('rounded-full px-4 py-1.5', mode === 'list' && 'bg-secondary font-medium')}><BookOpen size={14} className="mr-1.5 inline" />Danh sách</button>
          <button onClick={() => setMode('review')} className={cn('rounded-full px-4 py-1.5', mode === 'review' && 'bg-secondary font-medium')} data-testid="tab-review"><RotateCcw size={14} className="mr-1.5 inline" />Ôn tập ({dueCount})</button>
        </div>
      </PageTitle>
      {mode === 'review' ? (
        <Flashcards onDone={() => setMode('list')} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            {(['all', 'vocab', 'grammar'] as const).map((f) => (
              <button key={f} onClick={() => setFilter(f)} className={cn('rounded-full border px-3 py-1.5 text-sm', filter === f && 'border-primary bg-primary/10 text-primary')}>
                {f === 'all' ? 'Tất cả' : f === 'vocab' ? 'Từ vựng' : 'Ngữ pháp'}
              </button>
            ))}
            <div className="ml-auto"><AddItemForm /></div>
          </div>
          {all.isLoading && <Skeleton className="h-60 rounded-2xl" />}
          {all.data && items.length === 0 && <div className="rounded-2xl border border-dashed p-10 text-center text-sm text-muted-foreground">Sổ tay còn trống. Yuki-sensei sẽ tự lưu từ mới vào đây trong lúc học.</div>}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => {
              const due = new Date(item.dueAt) <= new Date();
              return (
                <div key={item.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="text-2xl" lang="ja">{item.data.kana && isKanji(item.term) ? <Ruby kanji={item.term} kana={item.data.kana} /> : item.term}</div>
                    <span className={cn('mono shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase', due ? 'bg-accent/25' : 'bg-secondary text-muted-foreground')}>
                      {due ? 'đến hạn' : `${new Date(item.dueAt).toLocaleDateString('vi-VN')}`}
                    </span>
                  </div>
                  {item.data.romaji && <p className="mono mt-1 text-xs text-muted-foreground">{item.data.romaji}</p>}
                  <p className="mt-2 font-medium">{item.data.meaningVi}</p>
                  {item.data.example && <p className="mt-2 text-sm" lang="ja">{item.data.example}</p>}
                  <p className="mt-3 text-[11px] text-muted-foreground">Ease {item.ease.toFixed(2)} · khoảng cách {item.intervalDays} ngày · {item.repetitions} lần đúng</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </AppShell>
  );
}

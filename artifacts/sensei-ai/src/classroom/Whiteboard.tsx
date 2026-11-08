import { useState } from 'react';
import { CheckCircle2, PenLine, XCircle } from 'lucide-react';
import { Ruby } from '@/components/jp-text';
import { cn } from '@/lib/utils';
import type { BoardItem, QuizQuestion } from './types';

export type ActiveQuiz = { quizId: string; questions: QuizQuestion[]; submitted?: number[] };

function BoardCard({ item, showRomaji, big }: { item: BoardItem; showRomaji: boolean; big: boolean }) {
  return (
    <div className="board-card rounded-2xl border border-[#e4ddcc] bg-[#fffdf7] p-4 shadow-[0_6px_18px_rgba(48,61,54,.06)]">
      <div className={cn('font-medium leading-[1.6] text-[#1f2f2a]', big ? 'text-5xl md:text-6xl' : 'text-3xl md:text-4xl')} lang="ja">
        <Ruby kanji={item.kanji} kana={item.kana} />
      </div>
      {showRomaji && item.romaji && <p className="mono mt-1 text-sm text-[#6d7a73]">{item.romaji}</p>}
      <p className="mt-2 text-base font-semibold text-[#426b5e]">{item.meaning_vi}</p>
      {item.example && (
        <div className="mt-3 border-t border-dashed border-[#e4ddcc] pt-3 text-sm">
          <p lang="ja" className="text-[#1f2f2a]">{item.example}</p>
          {item.example_vi && <p className="mt-0.5 text-[#6d7a73]">{item.example_vi}</p>}
        </div>
      )}
    </div>
  );
}

function Quiz({ quiz, onSubmit }: { quiz: ActiveQuiz; onSubmit: (answers: number[]) => void }) {
  const [choices, setChoices] = useState<number[]>(() => quiz.questions.map(() => -1));
  const done = Boolean(quiz.submitted);
  const answers = quiz.submitted ?? choices;
  return (
    <div className="space-y-4">
      {quiz.questions.map((q, qi) => (
        <div key={qi} className="rounded-2xl border border-[#e4ddcc] bg-[#fffdf7] p-4">
          <p className="font-medium text-[#1f2f2a]"><span className="mono mr-2 text-xs text-[#9a8f7a]">Q{qi + 1}</span>{q.question}</p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {q.options.map((opt, oi) => {
              const picked = answers[qi] === oi;
              const correct = q.answer_index === oi;
              return (
                <button
                  key={oi}
                  disabled={done}
                  onClick={() => setChoices((c) => c.map((v, i) => (i === qi ? oi : v)))}
                  className={cn(
                    'flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left text-sm transition',
                    !done && picked && 'border-[#426b5e] bg-[#426b5e]/10',
                    !done && !picked && 'border-[#e4ddcc] hover:border-[#426b5e]/50',
                    done && correct && 'border-[#426b5e] bg-[#426b5e]/10',
                    done && picked && !correct && 'border-[#b4594f] bg-[#b4594f]/10',
                    done && !picked && !correct && 'border-[#e4ddcc] opacity-60',
                  )}
                  data-testid={`quiz-${qi}-option-${oi}`}
                >
                  <span lang="ja">{opt}</span>
                  {done && correct && <CheckCircle2 size={16} className="shrink-0 text-[#426b5e]" />}
                  {done && picked && !correct && <XCircle size={16} className="shrink-0 text-[#b4594f]" />}
                </button>
              );
            })}
          </div>
          {done && q.explanation_vi && <p className="mt-2 text-xs text-[#6d7a73]">{q.explanation_vi}</p>}
        </div>
      ))}
      {!done && (
        <button
          disabled={choices.some((c) => c < 0)}
          onClick={() => onSubmit(choices)}
          className="w-full rounded-xl bg-[#426b5e] px-4 py-3 font-medium text-[#fbf8ef] disabled:opacity-40"
          data-testid="button-submit-quiz"
        >
          Nộp bài
        </button>
      )}
      {done && (
        <p className="text-center text-sm font-medium text-[#426b5e]">
          Đúng {quiz.questions.filter((q, i) => q.answer_index === answers[i]).length}/{quiz.questions.length} câu
        </p>
      )}
    </div>
  );
}

export function Whiteboard({
  items,
  quiz,
  onSubmitQuiz,
  className,
}: {
  items: BoardItem[];
  quiz: ActiveQuiz | null;
  onSubmitQuiz: (answers: number[]) => void;
  className?: string;
}) {
  const [showRomaji, setShowRomaji] = useState(true);
  const [tab, setTab] = useState<'board' | 'quiz'>('board');
  const activeTab = quiz && !quiz.submitted ? 'quiz' : tab;
  return (
    <section className={cn('flex min-h-0 flex-col overflow-hidden rounded-2xl bg-[#f6f1e4] text-[#1f2f2a]', className)} aria-label="Bảng trắng">
      <header className="flex items-center justify-between gap-2 border-b border-[#e4ddcc] px-4 py-2.5">
        <div className="flex items-center gap-1 text-sm">
          <PenLine size={15} className="text-[#426b5e]" />
          <button onClick={() => setTab('board')} className={cn('rounded-full px-2.5 py-1', activeTab === 'board' && 'bg-[#e9e1cd] font-medium')}>Bảng trắng</button>
          {quiz && <button onClick={() => setTab('quiz')} className={cn('rounded-full px-2.5 py-1', activeTab === 'quiz' && 'bg-[#e9e1cd] font-medium')}>Quiz{!quiz.submitted && ' •'}</button>}
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-[#6d7a73]">
          Romaji
          <button
            role="switch"
            aria-checked={showRomaji}
            onClick={() => setShowRomaji((v) => !v)}
            className={cn('relative h-5 w-9 rounded-full transition', showRomaji ? 'bg-[#426b5e]' : 'bg-[#d6cfbd]')}
            data-testid="toggle-romaji"
          >
            <span className={cn('absolute top-0.5 size-4 rounded-full bg-white transition', showRomaji ? 'left-[18px]' : 'left-0.5')} />
          </button>
        </label>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        {activeTab === 'quiz' && quiz ? (
          <Quiz key={quiz.quizId} quiz={quiz} onSubmit={onSubmitQuiz} />
        ) : items.length === 0 ? (
          <div className="grid h-full min-h-40 place-items-center text-center text-sm text-[#9a8f7a]">
            <div><p className="text-4xl" lang="ja">黒板</p><p className="mt-2">Sensei sẽ viết từ mới lên đây.</p></div>
          </div>
        ) : (
          <div className={cn('grid gap-3', items.length > 1 && 'sm:grid-cols-2')}>
            {items.map((item, i) => <BoardCard key={`${item.kana}-${i}`} item={item} showRomaji={showRomaji} big={items.length === 1} />)}
          </div>
        )}
      </div>
    </section>
  );
}

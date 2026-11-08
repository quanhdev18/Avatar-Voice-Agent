import { addNotebookItem } from '@workspace/api-client-react';
import type { LessonDetail, NotebookItem } from '@workspace/api-client-react';
import type { BoardItem, ClassroomTransport, ClientAction, QuizQuestion, TeacherEvent } from './types';
import { languageFor } from './types';

/**
 * Offline "demo" teacher used when LiveKit / Gemini keys are not configured.
 * It runs the same 5-step lesson flow as the real agent from the seeded
 * curriculum, emits the same events (captions, board, quiz, notebook), and
 * speaks with the browser's speech synthesis. Useful for previewing the UI.
 */

type Step = {
  ja?: string;
  vi: string;
  board?: BoardItem[];
  notebook?: { type: 'vocab' | 'grammar'; term: string; kana?: string; romaji?: string; meaningVi: string; example?: string; exampleVi?: string };
  quiz?: QuizQuestion[];
  /** Wait for the learner to answer (chat or speech) before moving on. */
  expect?: { prompt?: string; check?: (reply: string) => boolean; good: string; hint: string };
  end?: boolean;
};

function shuffle<T>(items: T[], seed: number): T[] {
  const out = [...items];
  let s = seed;
  for (let i = out.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.floor((s / 233280) * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

function buildQuiz(lesson: LessonDetail): QuizQuestion[] {
  const vocab = lesson.vocab.slice(0, 6);
  return vocab.slice(0, 3).map((v, idx) => {
    const distractors = vocab.filter((o) => o !== v).map((o) => o.meaningVi).slice(0, 3);
    const options = shuffle([v.meaningVi, ...distractors].slice(0, 4), idx + 7);
    return {
      question: `「${v.kanji ?? v.kana}」(${v.romaji}) nghĩa là gì?`,
      options,
      answer_index: options.indexOf(v.meaningVi),
      explanation_vi: `${v.kanji ?? v.kana} = ${v.meaningVi}`,
    };
  });
}

export function buildScript(lesson: LessonDetail, due: NotebookItem[]): Step[] {
  const steps: Step[] = [];
  steps.push({ ja: 'こんにちは！ゆきです。', vi: `Chào bạn, mình là Yuki-sensei. Hôm nay mình học bài ${lesson.order}: ${lesson.titleVi}.` });
  if (due.length) {
    const items = due.slice(0, 3);
    steps.push({
      vi: `Trước khi học bài mới, mình ôn lại ${items.length} từ cũ nhé. Bạn còn nhớ nghĩa của các từ trên bảng không? Gõ thử một từ nhé.`,
      board: items.map((i) => ({ kanji: i.term !== i.data.kana ? i.term : undefined, kana: i.data.kana ?? i.term, romaji: i.data.romaji ?? '', meaning_vi: '？' })),
      expect: {
        check: (r) => items.some((i) => r.toLowerCase().includes(i.data.meaningVi.toLowerCase().split(/[ ,(]/)[0] ?? '')),
        good: 'Giỏi quá! Bạn nhớ rất tốt.',
        hint: `Đáp án: ${items.map((i) => `${i.term} là “${i.data.meaningVi}”`).join(', ')}.`,
      },
    });
  }
  steps.push({ vi: `Mục tiêu hôm nay: ${lesson.objectivesVi.join('; ')}.` });

  lesson.vocab.slice(0, 5).forEach((v, idx) => {
    const written = v.kanji ?? v.kana;
    steps.push({
      ja: v.example ? `${written}。${v.example}` : `${written}。`,
      vi: `Từ “${written}”, đọc là ${v.romaji}, nghĩa là “${v.meaningVi}”.${v.exampleVi ? ` Ví dụ: ${v.exampleVi}` : ''}`,
      board: [{ kanji: v.kanji, kana: v.kana, romaji: v.romaji, meaning_vi: v.meaningVi, example: v.example, example_vi: v.exampleVi }],
      notebook: { type: 'vocab', term: written, kana: v.kana, romaji: v.romaji, meaningVi: v.meaningVi, example: v.example, exampleVi: v.exampleVi },
    });
    if (idx === 1) {
      steps.push({
        vi: `Bạn thử nói hoặc gõ lại từ “${v.meaningVi}” bằng tiếng Nhật nhé.`,
        expect: {
          check: (r) => r.includes(v.kana) || (v.kanji ? r.includes(v.kanji) : false) || r.toLowerCase().replace(/\s/g, '').includes(v.romaji.toLowerCase().replace(/\s/g, '')),
          good: `よくできました！Chính xác, “${v.kanji ?? v.kana}”.`,
          hint: `Gần đúng rồi! Cách nói đúng là ${v.kana}, đọc ${v.romaji}. Mình đọc lại nhé: ${v.kana}.`,
        },
      });
    }
  });

  lesson.grammar.slice(0, 2).forEach((g) => {
    const ex = g.examples[0];
    steps.push({
      ja: ex?.ja,
      vi: `Ngữ pháp: ${g.pattern}, nghĩa là ${g.meaningVi}. ${g.explanationVi}${ex ? ` Ví dụ: ${ex.vi}` : ''}`,
      board: [{ kana: g.pattern, romaji: ex?.romaji ?? '', meaning_vi: g.meaningVi, example: ex?.ja, example_vi: ex?.vi }],
      notebook: { type: 'grammar', term: g.pattern, meaningVi: g.meaningVi, example: ex?.ja, exampleVi: ex?.vi },
    });
  });

  const [first, second] = lesson.dialogue;
  if (first) {
    steps.push({ vi: `Giờ mình luyện nói. Tình huống: ${lesson.rolePlayVi} Mình nói trước nhé.`, ja: first.ja });
    steps.push({
      vi: 'Đến lượt bạn! Hãy trả lời bằng tiếng Nhật — nói vào mic hoặc gõ vào chat.',
      expect: {
        check: (r) => languageFor(r) !== 'vi',
        good: second ? `すばらしい！Câu mẫu của bài là: ${second.ja} — ${second.vi}` : 'すばらしい！',
        hint: second ? `Bạn thử dùng tiếng Nhật nhé. Câu mẫu: ${second.ja} — nghĩa là ${second.vi}` : 'Bạn thử dùng tiếng Nhật nhé.',
      },
    });
  }

  steps.push({ vi: 'Giờ làm quiz nhanh 3 câu trên bảng nhé. Chọn đáp án rồi bấm Nộp bài.', quiz: buildQuiz(lesson) });
  steps.push({
    ja: 'おつかれさまでした！',
    vi: `Hôm nay bạn đã học ${Math.min(5, lesson.vocab.length)} từ mới và ${Math.min(2, lesson.grammar.length)} mẫu ngữ pháp. Các từ đã được lưu vào sổ tay để ôn tập. Hẹn gặp lại bạn!`,
    end: true,
  });
  return steps;
}

function isQuestion(text: string) {
  return /[?？]|(^|\s)(gì|sao|không|nào|nghĩa là)(?=$|[\s,.!])|(なに|なん|ですか)/iu.test(text);
}

type Waiter<T> = { resolve: (v: T) => void; timer: number };

export class DemoTransport implements ClassroomTransport {
  readonly kind = 'demo' as const;
  private steps: Step[] = [];
  private index = 0;
  private slow = false;
  private stopped = false;
  private interrupted = false;
  private pendingQuestions: string[] = [];
  private replyWaiter: Waiter<string | null> | null = null;
  private quizWaiter: Waiter<{ questionIndex: number; choiceIndex: number }[] | null> | null = null;
  private recognition: { start(): void; stop(): void; abort(): void } | null = null;
  private speaking = false;
  private handRaised = false;

  constructor(
    private lesson: LessonDetail,
    private due: NotebookItem[],
    private emit: (event: TeacherEvent) => void,
  ) {}

  async start() {
    this.steps = buildScript(this.lesson, this.due);
    this.emit({ type: 'connection', status: 'connected' });
    this.emit({ type: 'avatar', status: 'disabled' });
    void this.run();
  }

  // ---------------------------------------------------------------- speech
  private cancelTimer: (() => void) | null = null;

  private cancelSpeech() {
    this.cancelTimer?.();
    this.cancelTimer = null;
    try {
      window.speechSynthesis?.cancel();
    } catch {
      /* noop */
    }
  }

  private speakPart(text: string, lang: 'ja-JP' | 'vi-VN'): Promise<void> {
    return new Promise((resolve) => {
      // Reading-time estimate, used when the browser has no voice for this language.
      const estimateMs = Math.min(12_000, 900 + text.length * (this.slow ? 95 : 70));
      const synth = typeof window !== 'undefined' ? window.speechSynthesis : undefined;
      const voices = synth?.getVoices() ?? [];
      const voice = voices.find((v) => v.lang.replace('_', '-').toLowerCase().startsWith(lang.slice(0, 2)));
      if (!synth || typeof SpeechSynthesisUtterance === 'undefined' || !voice) {
        const timer = window.setTimeout(resolve, estimateMs);
        this.cancelTimer = () => {
          window.clearTimeout(timer);
          resolve();
        };
        return;
      }
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang;
      u.voice = voice;
      u.rate = this.slow ? 0.7 : lang === 'ja-JP' ? 0.9 : 1;
      const startedAt = Date.now();
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        resolve();
      };
      u.onend = finish;
      // If the engine errors out immediately, still give the learner time to read.
      u.onerror = () => window.setTimeout(finish, Math.max(0, estimateMs - (Date.now() - startedAt)));
      window.setTimeout(finish, estimateMs * 2 + 4000); // engines that never fire onend
      this.cancelTimer = finish;
      synth.speak(u);
    });
  }

  private async say(step: { ja?: string; vi: string }) {
    const text = [step.ja, step.vi].filter(Boolean).join(' ');
    this.emit({ type: 'caption', speaker: 'teacher', text, language: languageFor(text), ja: step.ja, vi: step.vi });
    this.speaking = true;
    this.emit({ type: 'agent_state', state: 'speaking' });
    if (step.ja && !this.interrupted && !this.stopped) await this.speakPart(step.ja, 'ja-JP');
    if (!this.interrupted && !this.stopped) await this.speakPart(step.vi, 'vi-VN');
    this.speaking = false;
    if (!this.stopped) this.emit({ type: 'agent_state', state: 'listening' });
  }

  // ---------------------------------------------------------------- waits
  private waitForReply(ms: number): Promise<string | null> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.replyWaiter = null;
        resolve(null);
      }, ms);
      this.replyWaiter = { resolve, timer };
    });
  }

  private waitForQuiz(): Promise<{ questionIndex: number; choiceIndex: number }[] | null> {
    return new Promise((resolve) => {
      const timer = window.setTimeout(() => {
        this.quizWaiter = null;
        resolve(null);
      }, 5 * 60_000);
      this.quizWaiter = { resolve, timer };
    });
  }

  private answerQuestion(question: string) {
    const q = question.toLowerCase();
    const hit = this.lesson.vocab.find(
      (v) => q.includes(v.kana) || (v.kanji && q.includes(v.kanji)) || q.includes(v.romaji.toLowerCase()) || q.includes(v.meaningVi.toLowerCase()),
    );
    if (hit) {
      return {
        ja: `${hit.kanji ?? hit.kana}。`,
        vi: `Câu hỏi hay! “${hit.kanji ?? hit.kana}” đọc là ${hit.romaji}, nghĩa là “${hit.meaningVi}”.${hit.example ? ` Ví dụ: ${hit.example}` : ''} Mình quay lại bài nhé.`,
        board: [{ kanji: hit.kanji, kana: hit.kana, romaji: hit.romaji, meaning_vi: hit.meaningVi, example: hit.example, example_vi: hit.exampleVi }],
      };
    }
    const g = this.lesson.grammar.find((gp) => q.includes(gp.pattern.toLowerCase()) || gp.pattern.split(/\s+/).some((t) => t.length > 1 && q.includes(t)));
    if (g) return { vi: `Về ${g.pattern}: ${g.explanationVi} Mình quay lại bài nhé.` };
    return {
      vi: 'Cảm ơn câu hỏi của bạn! Ở chế độ demo mình chỉ trả lời được về từ vựng và ngữ pháp của bài này. Khi kết nối Gemini, Yuki-sensei sẽ trả lời mọi câu hỏi. Mình quay lại bài nhé.',
    };
  }

  private async handleQuestions() {
    if (this.handRaised && !this.stopped) {
      this.handRaised = false;
      this.interrupted = false;
      await this.say({ vi: 'Bạn muốn hỏi gì nào? Cứ gõ vào khung chat hoặc nói nhé.' });
      const q = await this.waitForReply(30_000);
      if (q) this.pendingQuestions.push(q);
    }
    while (this.pendingQuestions.length && !this.stopped) {
      const q = this.pendingQuestions.shift()!;
      this.emit({ type: 'agent_state', state: 'thinking' });
      await new Promise((r) => window.setTimeout(r, 500));
      const answer = this.answerQuestion(q);
      if ('board' in answer && answer.board) this.emit({ type: 'board', items: answer.board });
      this.interrupted = false;
      await this.say(answer);
    }
  }

  // ---------------------------------------------------------------- main loop
  private async run() {
    await new Promise((r) => window.setTimeout(r, 700));
    while (!this.stopped && this.index < this.steps.length) {
      await this.handleQuestions();
      const step = this.steps[this.index]!;
      this.interrupted = false;
      if (step.board) this.emit({ type: 'board', items: step.board });
      if (step.notebook) void this.saveNotebook(step.notebook);
      await this.say(step);
      if (this.stopped) return;
      if (this.interrupted) continue; // re-run the same step after the interruption

      if (step.expect) {
        let reply = await this.waitForReply(25_000);
        // The learner asked something instead of answering: answer, then ask again.
        if (reply && isQuestion(reply)) {
          this.pendingQuestions.push(reply);
          await this.handleQuestions();
          if (step.expect.prompt !== '') await this.say({ vi: 'Giờ bạn thử trả lời câu lúc nãy nhé.' });
          reply = await this.waitForReply(25_000);
        }
        if (this.stopped) return;
        this.interrupted = false;
        if (reply === null) await this.say({ vi: 'Không sao, mình xem tiếp nhé.' });
        else await this.say({ vi: step.expect.check?.(reply) ? step.expect.good : step.expect.hint });
      }
      if (step.quiz) {
        const quizId = `demo-quiz-${Date.now()}`;
        this.emit({ type: 'quiz', quizId, questions: step.quiz });
        const answers = await this.waitForQuiz();
        if (this.stopped) return;
        const correct = (answers ?? []).filter((a) => step.quiz![a.questionIndex]?.answer_index === a.choiceIndex).length;
        await this.say({
          vi: answers
            ? `Bạn đúng ${correct}/${step.quiz.length} câu. ${correct === step.quiz.length ? 'Tuyệt vời!' : 'Xem lại phần giải thích trên bảng nhé.'}`
            : 'Mình bỏ qua quiz nhé.',
        });
      }
      if (step.end) {
        this.emit({ type: 'progress', lessonId: this.lesson.id, status: 'completed' });
        this.emit({ type: 'session_end', reason: 'lesson_complete' });
        return;
      }
      this.index += 1;
    }
  }

  private async saveNotebook(item: NonNullable<Step['notebook']>) {
    try {
      await addNotebookItem({
        type: item.type,
        sourceLessonId: this.lesson.id,
        data: { term: item.term, kana: item.kana, romaji: item.romaji, meaningVi: item.meaningVi, example: item.example, exampleVi: item.exampleVi },
      });
      this.emit({ type: 'notebook_added', term: item.term, itemType: item.type });
    } catch {
      /* non-fatal in demo */
    }
  }

  // ---------------------------------------------------------------- learner input
  private learnerSaid(text: string) {
    this.emit({ type: 'caption', speaker: 'learner', text, language: languageFor(text) });
    if (this.replyWaiter) {
      window.clearTimeout(this.replyWaiter.timer);
      const w = this.replyWaiter;
      this.replyWaiter = null;
      w.resolve(text);
      return;
    }
    // Barge-in: stop talking, answer, then resume the current step.
    this.pendingQuestions.push(text);
    if (this.speaking) {
      this.interrupted = true;
      this.cancelSpeech();
    } else if (this.quizWaiter) {
      void this.handleQuestions();
    }
  }

  async send(action: ClientAction) {
    switch (action.type) {
      case 'interruption':
        this.learnerSaid(action.text);
        return true;
      case 'raise_hand':
        if (this.replyWaiter) return true; // already waiting for the learner
        this.handRaised = true;
        if (this.speaking) {
          this.interrupted = true;
          this.cancelSpeech();
        } else if (this.quizWaiter) {
          void this.handleQuestions();
        }
        return true;
      case 'repeat':
        if (action.slower) this.slow = true;
        this.interrupted = true; // the loop re-runs the current step
        this.cancelSpeech();
        return true;
      case 'slower':
        this.slow = action.enabled;
        return true;
      case 'quiz_answer':
        if (this.quizWaiter) {
          window.clearTimeout(this.quizWaiter.timer);
          const w = this.quizWaiter;
          this.quizWaiter = null;
          w.resolve(action.answers);
        }
        return true;
      default:
        return true;
    }
  }

  async setMicrophone(enabled: boolean) {
    type Rec = { lang: string; continuous: boolean; interimResults: boolean; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> ; resultIndex: number }) => void) | null; onerror: (() => void) | null; start(): void; stop(): void; abort(): void };
    const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
    if (!enabled) {
      this.recognition?.abort();
      this.recognition = null;
      return false;
    }
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return false;
    try {
      const rec = new Ctor();
      rec.lang = 'vi-VN';
      rec.continuous = true;
      rec.interimResults = false;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i]!;
          if (r.isFinal && r[0]?.transcript.trim()) this.learnerSaid(r[0].transcript.trim());
        }
      };
      rec.onerror = () => {
        this.recognition = null;
      };
      rec.start();
      this.recognition = rec;
      return true;
    } catch {
      return false;
    }
  }

  async disconnect() {
    this.stopped = true;
    this.cancelSpeech();
    this.recognition?.abort();
    if (this.replyWaiter) this.replyWaiter.resolve(null);
    if (this.quizWaiter) this.quizWaiter.resolve(null);
  }
}

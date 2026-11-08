export type Lang = 'ja' | 'vi' | 'mixed';

export type BoardItem = {
  kanji?: string;
  kana: string;
  romaji: string;
  meaning_vi: string;
  example?: string;
  example_vi?: string;
};

export type QuizQuestion = {
  question: string;
  options: string[];
  answer_index: number;
  explanation_vi?: string;
};

/** Messages the teacher (agent or demo) sends to the classroom UI. */
export type TeacherEvent =
  | { type: 'caption'; speaker: 'teacher' | 'learner'; text: string; language: Lang; ja?: string; vi?: string }
  | { type: 'live_caption'; text: string; final: boolean }
  | { type: 'board'; items: BoardItem[] }
  | { type: 'quiz'; quizId: string; questions: QuizQuestion[] }
  | { type: 'notebook_added'; term: string; itemType?: string }
  | { type: 'avatar'; status: 'connected' | 'fallback' | 'disabled'; identity?: string; provider?: string }
  | { type: 'avatar_track'; element: HTMLVideoElement | null }
  | { type: 'agent_state'; state: 'initializing' | 'listening' | 'thinking' | 'speaking' | string }
  | { type: 'time_warning'; secondsLeft: number }
  | { type: 'session_end'; reason: string }
  | { type: 'progress'; lessonId: string; status: string }
  | { type: 'connection'; status: 'connected' | 'reconnecting' | 'disconnected' };

/** Messages the learner sends to the teacher. */
export type ClientAction =
  | { type: 'interruption'; text: string }
  | { type: 'raise_hand' }
  | { type: 'repeat'; slower?: boolean }
  | { type: 'slower'; enabled: boolean }
  | { type: 'quiz_answer'; quizId: string; answers: { questionIndex: number; choiceIndex: number }[] }
  | { type: 'mic_unavailable' };

export interface ClassroomTransport {
  readonly kind: 'live' | 'demo';
  start(): Promise<void>;
  send(action: ClientAction): Promise<boolean>;
  /** Returns the resulting mic state (false if the mic could not be enabled). */
  setMicrophone(enabled: boolean): Promise<boolean>;
  disconnect(): Promise<void>;
}

export function languageFor(text: string): Lang {
  const hasJapanese = /[぀-ヿ㐀-鿿]/u.test(text);
  const hasVietnamese = /[ăâđêôơưàáạảãằắặẳẵèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/iu.test(text);
  if (hasJapanese && hasVietnamese) return 'mixed';
  if (hasJapanese) return 'ja';
  return 'vi';
}

/** Split a teacher utterance into a Japanese line and a Vietnamese line for bilingual subtitles. */
export function splitBilingual(text: string): { ja: string; vi: string } {
  const parts = text.match(/[^。！？!?.\n]+[。！？!?.]?/gu) ?? [text];
  const ja: string[] = [];
  const vi: string[] = [];
  for (const raw of parts) {
    const p = raw.trim();
    if (!p) continue;
    const lang = languageFor(p);
    if (lang === 'ja') ja.push(p);
    else vi.push(p);
  }
  return { ja: ja.join(' '), vi: vi.join(' ') };
}

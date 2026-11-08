import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useParams } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  BookmarkPlus,
  Captions,
  CaptionsOff,
  Clock3,
  Hand,
  LoaderCircle,
  MessageSquare,
  Mic,
  MicOff,
  PanelRight,
  PhoneOff,
  Play,
  RotateCcw,
  Send,
  Snail,
  Video,
  VideoOff,
  WifiOff,
  X,
} from 'lucide-react';
import {
  getGetDashboardQueryKey,
  getGetLessonQueryKey,
  getGetVoiceStatusQueryKey,
  listNotebook,
  useFinishVoiceSession,
  useGetLesson,
  useGetVoiceStatus,
  useStartVoiceSession,
} from '@workspace/api-client-react';
import type { FinishedVoiceSession, StartedVoiceSession, TranscriptEntry } from '@workspace/api-client-react';
import { Ruby } from '@/components/jp-text';
import { cn } from '@/lib/utils';
import { DemoTransport } from '@/classroom/demoTransport';
import { LiveTransport } from '@/classroom/liveTransport';
import { YukiPortrait } from '@/classroom/YukiPortrait';
import { Whiteboard } from '@/classroom/Whiteboard';
import type { ActiveQuiz } from '@/classroom/Whiteboard';
import type { BoardItem, ClassroomTransport, ClientAction, TeacherEvent } from '@/classroom/types';
import { languageFor, splitBilingual } from '@/classroom/types';

function clock(seconds: number) {
  const s = Math.max(0, seconds);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

type Phase = 'lobby' | 'connecting' | 'live' | 'finishing' | 'done';

function ControlButton({
  active = true,
  danger,
  label,
  onClick,
  disabled,
  children,
  testId,
  highlight,
}: {
  active?: boolean;
  danger?: boolean;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  testId?: string;
  highlight?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      data-testid={testId}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full transition disabled:opacity-40 sm:size-11 md:size-12',
        danger
          ? 'w-14 bg-[#d9534a] text-white hover:bg-[#c4473f] md:w-20'
          : highlight
            ? 'bg-[#e8c27f] text-[#1d2622]'
            : active
              ? 'bg-[#33413c] text-[#eef0ea] hover:bg-[#3d4d47]'
              : 'bg-[#d9534a] text-white hover:bg-[#c4473f]',
      )}
    >
      {children}
    </button>
  );
}

export default function ClassroomPage() {
  const { lessonId = 'n5-02-greetings' } = useParams<{ lessonId: string }>();
  const qc = useQueryClient();
  const lessonQuery = useGetLesson(lessonId, { query: { queryKey: getGetLessonQueryKey(lessonId) } });
  const status = useGetVoiceStatus({ query: { queryKey: getGetVoiceStatusQueryKey() } });
  const startSession = useStartVoiceSession();
  const finishSession = useFinishVoiceSession();

  const [phase, setPhase] = useState<Phase>('lobby');
  const [session, setSession] = useState<StartedVoiceSession | null>(null);
  const [result, setResult] = useState<FinishedVoiceSession | null>(null);
  const [notice, setNotice] = useState<{ text: string; tone?: 'error' | 'info' } | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [subtitle, setSubtitle] = useState<{ ja: string; vi: string } | null>(null);
  const [board, setBoard] = useState<BoardItem[]>([]);
  const [quiz, setQuiz] = useState<ActiveQuiz | null>(null);
  const [agentState, setAgentState] = useState('initializing');
  const [avatarEl, setAvatarEl] = useState<HTMLVideoElement | null>(null);
  const [avatarStatus, setAvatarStatus] = useState<'pending' | 'connected' | 'fallback' | 'disabled'>('pending');
  const [connection, setConnection] = useState<'connected' | 'reconnecting' | 'disconnected'>('connected');
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [slow, setSlow] = useState(false);
  const [panel, setPanel] = useState<'board' | 'chat'>('board');
  const [panelOpen, setPanelOpen] = useState(true);
  const [unreadBoard, setUnreadBoard] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [question, setQuestion] = useState('');
  const [savedTerms, setSavedTerms] = useState<string[]>([]);
  const [lessonCompleted, setLessonCompleted] = useState(false);

  const transportRef = useRef<ClassroomTransport | null>(null);
  const startedAtRef = useRef<number>(0);
  const transcriptRef = useRef<TranscriptEntry[]>([]);
  const avatarHostRef = useRef<HTMLDivElement>(null);
  const camRef = useRef<HTMLVideoElement>(null);
  const camStreamRef = useRef<MediaStream | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const finishRef = useRef<(reason?: string) => void>(() => undefined);
  const panelRef = useRef(panel);
  panelRef.current = panel;

  const lesson = lessonQuery.data;
  const maxSeconds = session?.maxDurationSeconds ?? 15 * 60;
  const remaining = maxSeconds - elapsed;

  const pushTranscript = useCallback((entry: Omit<TranscriptEntry, 'elapsedMs'>) => {
    const full = { ...entry, text: entry.text.slice(0, 5000), elapsedMs: Math.max(0, Date.now() - startedAtRef.current) };
    transcriptRef.current = [...transcriptRef.current, full].slice(-1000);
    setTranscript(transcriptRef.current);
  }, []);

  const handleEvent = useCallback(
    (event: TeacherEvent) => {
      switch (event.type) {
        case 'caption':
          pushTranscript({ speaker: event.speaker, text: event.text, language: event.language });
          if (event.speaker === 'teacher') setSubtitle(event.ja !== undefined || event.vi !== undefined ? { ja: event.ja ?? '', vi: event.vi ?? '' } : splitBilingual(event.text));
          break;
        case 'live_caption':
          setSubtitle(splitBilingual(event.text));
          break;
        case 'board':
          setBoard(event.items);
          if (panelRef.current !== 'board') setUnreadBoard(true);
          break;
        case 'quiz':
          setQuiz({ quizId: event.quizId, questions: event.questions });
          setPanel('board');
          setPanelOpen(true);
          break;
        case 'notebook_added':
          setSavedTerms((t) => [event.term, ...t.filter((x) => x !== event.term)].slice(0, 20));
          break;
        case 'avatar':
          setAvatarStatus(event.status);
          if (event.status === 'fallback') setNotice({ text: 'Mất kết nối avatar — chuyển sang chế độ giọng nói + ảnh tĩnh.', tone: 'info' });
          break;
        case 'avatar_track':
          setAvatarEl(event.element);
          if (event.element) setAvatarStatus('connected');
          break;
        case 'agent_state':
          setAgentState(event.state);
          break;
        case 'time_warning':
          setNotice({ text: `Còn khoảng ${Math.round(event.secondsLeft / 60)} phút — Sensei sẽ tóm tắt bài.`, tone: 'info' });
          break;
        case 'progress':
          if (event.status === 'completed') setLessonCompleted(true);
          break;
        case 'connection':
          setConnection(event.status);
          if (event.status === 'disconnected' && transportRef.current) finishRef.current('disconnected');
          break;
        case 'session_end':
          window.setTimeout(() => finishRef.current(event.reason), 1500);
          break;
      }
    },
    [pushTranscript],
  );

  // Attach avatar <video> element when it arrives.
  useEffect(() => {
    const host = avatarHostRef.current;
    if (!host) return;
    host.replaceChildren();
    if (avatarEl) {
      avatarEl.className = 'h-full w-full object-cover';
      avatarEl.playsInline = true;
      host.appendChild(avatarEl);
    }
  }, [avatarEl]);

  // Session clock + hard limit.
  useEffect(() => {
    if (phase !== 'live') return;
    const t = window.setInterval(() => {
      const secs = Math.floor((Date.now() - startedAtRef.current) / 1000);
      setElapsed(secs);
      if (secs >= maxSeconds) finishRef.current('time_limit');
    }, 1000);
    return () => window.clearInterval(t);
  }, [phase, maxSeconds]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ block: 'end' });
  }, [transcript.length, panel]);

  const stopCamera = () => {
    camStreamRef.current?.getTracks().forEach((t) => t.stop());
    camStreamRef.current = null;
    setCamOn(false);
  };

  useEffect(
    () => () => {
      void transportRef.current?.disconnect();
      camStreamRef.current?.getTracks().forEach((t) => t.stop());
    },
    [],
  );

  const begin = async (mode: 'voice' | 'demo') => {
    if (!lesson) return;
    setNotice(null);
    setPhase('connecting');
    try {
      const started = await startSession.mutateAsync({ data: { lessonId: lesson.id, mode } });
      setSession(started);
      transcriptRef.current = [];
      setTranscript([]);
      let transport: ClassroomTransport;
      if (started.mode === 'voice' && started.livekitUrl && started.participantToken) {
        transport = new LiveTransport(started.livekitUrl, started.participantToken, handleEvent);
      } else {
        const due = await listNotebook({ due: true }).catch(() => []);
        transport = new DemoTransport(lesson, due, handleEvent);
      }
      transportRef.current = transport;
      startedAtRef.current = Date.now();
      await transport.start();
      setPhase('live');
      // Try the mic; if it is unavailable fall back to chat.
      const ok = await transport.setMicrophone(true);
      setMicOn(ok);
      if (!ok) {
        setPanel('chat');
        setNotice({ text: transport.kind === 'demo' ? 'Trình duyệt không hỗ trợ nhận giọng nói — hãy gõ trong khung chat.' : 'Không bật được micro — chuyển sang khung chat.', tone: 'info' });
        if (transport.kind === 'live') void transport.send({ type: 'mic_unavailable' });
      }
    } catch (err) {
      transportRef.current = null;
      setPhase('lobby');
      const message = err instanceof Error ? err.message : '';
      setNotice({
        text: message.includes('429') || message.includes('hết')
          ? 'Bạn đã dùng hết số phút học hôm nay. Hẹn gặp lại ngày mai!'
          : `Không vào được lớp${message ? `: ${message}` : ''}.`,
        tone: 'error',
      });
    }
  };

  const finish = async (reason?: string) => {
    const transport = transportRef.current;
    if (!transport || !session) return;
    transportRef.current = null;
    setPhase('finishing');
    stopCamera();
    await transport.disconnect().catch(() => undefined);
    try {
      const saved = await finishSession.mutateAsync({
        sessionId: session.sessionId,
        data: {
          durationSeconds: Math.min(3600, Math.floor((Date.now() - startedAtRef.current) / 1000)),
          transcript: transcriptRef.current,
          lessonCompleted: lessonCompleted || reason === 'lesson_complete',
        },
      });
      setResult(saved);
      void qc.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setPhase('done');
    } catch {
      setNotice({ text: 'Không lưu được buổi học. Kiểm tra kết nối rồi thử lại.', tone: 'error' });
      setPhase('done');
    }
  };
  finishRef.current = (reason) => void finish(reason);

  const send = async (action: ClientAction) => {
    const ok = (await transportRef.current?.send(action)) ?? false;
    if (!ok) setNotice({ text: 'Tin nhắn chưa tới được Sensei. Thử lại nhé.', tone: 'error' });
    return ok;
  };

  const toggleMic = async () => {
    const t = transportRef.current;
    if (!t) return;
    const next = await t.setMicrophone(!micOn);
    setMicOn(next);
    if (!micOn && !next) {
      setPanel('chat');
      setPanelOpen(true);
      setNotice({ text: 'Micro không khả dụng — bạn có thể gõ câu hỏi trong chat.', tone: 'info' });
    }
  };

  const toggleCam = async () => {
    if (camOn) return stopCamera();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: false });
      camStreamRef.current = stream;
      setCamOn(true);
      window.setTimeout(() => {
        if (camRef.current) camRef.current.srcObject = stream;
      }, 0);
    } catch {
      setNotice({ text: 'Không mở được camera. Kiểm tra quyền truy cập của trình duyệt.', tone: 'error' });
    }
  };

  const ask = async (e: FormEvent) => {
    e.preventDefault();
    const text = question.trim();
    if (!text) return;
    if (await send({ type: 'interruption', text })) {
      if (transportRef.current?.kind === 'live') pushTranscript({ speaker: 'learner', text, language: languageFor(text) });
      setQuestion('');
    }
  };

  const submitQuiz = (answers: number[]) => {
    if (!quiz) return;
    setQuiz({ ...quiz, submitted: answers });
    void send({ type: 'quiz_answer', quizId: quiz.quizId, answers: answers.map((choiceIndex, questionIndex) => ({ questionIndex, choiceIndex })) });
  };

  // ------------------------------------------------------------------ render
  if (lessonQuery.isLoading) {
    return <div className="grid min-h-screen place-items-center bg-[#1d2622] text-[#eef0ea]"><LoaderCircle className="spin" /></div>;
  }
  if (!lesson) {
    return (
      <div className="grid min-h-screen place-items-center bg-[#1d2622] p-6 text-center text-[#eef0ea]">
        <div><p>Không tìm thấy bài học.</p><Link href="/lessons" className="mt-3 inline-block underline">Chọn bài khác</Link></div>
      </div>
    );
  }

  if (phase === 'lobby' || (phase === 'connecting' && !session)) {
    const voiceReady = Boolean(status.data?.available);
    return (
      <div className="min-h-screen bg-[#1d2622] text-[#eef0ea]">
        <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 md:py-12">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-[#aab5ae] hover:text-white"><ArrowLeft size={16} /> Tổng quan</Link>
          <div className="grid items-center gap-8 md:grid-cols-[1.2fr_1fr]">
            <div className="relative aspect-video overflow-hidden rounded-3xl bg-black/30 shadow-2xl">
              <YukiPortrait speaking={false} />
              <span className="absolute bottom-3 left-3 rounded-lg bg-black/50 px-2.5 py-1 text-sm">Yuki-sensei</span>
            </div>
            <div>
              <p className="mono text-[11px] tracking-[0.2em] text-[#aab5ae]">BÀI {String(lesson.order).padStart(2, '0')} · JLPT {lesson.level}</p>
              <h1 className="serif mt-2 text-4xl md:text-5xl">{lesson.titleVi}</h1>
              <p className="mt-1 text-xl text-[#c9d1cb]" lang="ja">{lesson.title}</p>
              <ul className="mt-5 space-y-1.5 text-sm text-[#c9d1cb]">
                {lesson.objectivesVi.map((o) => <li key={o}>• {o}</li>)}
              </ul>
              <p className="mt-4 flex items-center gap-2 text-xs text-[#aab5ae]"><Clock3 size={14} /> Khoảng 15 phút · chào hỏi → bài mới → luyện nói → quiz → tóm tắt</p>
              <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
                <button
                  onClick={() => begin('voice')}
                  disabled={!voiceReady || phase === 'connecting'}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#8fc2ae] px-6 py-3 font-medium text-[#1d2622] disabled:opacity-40"
                  data-testid="button-join-voice"
                >
                  {phase === 'connecting' ? <LoaderCircle size={17} className="spin" /> : <Video size={17} />} Vào lớp
                </button>
                <button
                  onClick={() => begin('demo')}
                  disabled={phase === 'connecting'}
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-white/20 px-6 py-3 font-medium hover:bg-white/5 disabled:opacity-40"
                  data-testid="button-join-demo"
                >
                  <Play size={16} /> Học thử (demo)
                </button>
              </div>
              {status.data && !voiceReady && (
                <p className="mt-3 text-xs text-[#aab5ae]">
                  Lớp giọng nói thật cần cấu hình {status.data.missingProviders.join(', ')} (xem README). Chế độ demo dùng giọng đọc của trình duyệt và kịch bản bài học.
                </p>
              )}
              {status.data?.available && (
                <p className="mt-3 text-xs text-[#aab5ae]">Giọng nói: {status.data.voiceProvider} · Avatar: {status.data.avatarProvider ?? 'tắt (ảnh tĩnh)'}</p>
              )}
              {notice && <p className="mt-3 rounded-xl bg-[#d9534a]/15 px-3 py-2 text-sm text-[#ffb4ac]" role="alert">{notice.text}</p>}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (phase === 'done' || phase === 'finishing') {
    return (
      <div className="grid min-h-screen place-items-center bg-[#1d2622] p-4 text-[#eef0ea]">
        <div className="w-full max-w-lg rounded-3xl bg-[#26322e] p-7 text-center">
          {phase === 'finishing' ? (
            <><LoaderCircle className="spin mx-auto" /><p className="mt-3">Đang lưu buổi học và tạo tóm tắt…</p></>
          ) : (
            <>
              <p className="text-5xl" lang="ja">おつかれさま！</p>
              <p className="mt-2 text-[#c9d1cb]">Buổi học {clock(result?.durationSeconds ?? elapsed)} đã được lưu.</p>
              {result?.summary && <p className="mt-4 rounded-2xl bg-black/20 p-4 text-left text-sm leading-relaxed">{result.summary}</p>}
              {result && result.commonMistakes.length > 0 && (
                <div className="mt-3 text-left text-sm"><p className="font-medium">Lỗi cần chú ý</p><ul className="mt-1 list-disc pl-5 text-[#c9d1cb]">{result.commonMistakes.slice(0, 5).map((m, i) => <li key={i}>{m}</li>)}</ul></div>
              )}
              {savedTerms.length > 0 && <p className="mt-3 text-sm text-[#c9d1cb]">Đã lưu {savedTerms.length} mục vào sổ tay.</p>}
              {notice?.tone === 'error' && <p className="mt-3 text-sm text-[#ffb4ac]">{notice.text}</p>}
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {result && <Link href={`/history/${result.sessionId}`} className="rounded-full bg-[#8fc2ae] px-5 py-2.5 text-sm font-medium text-[#1d2622]">Xem transcript</Link>}
                <Link href="/notebook?review=1" className="rounded-full border border-white/20 px-5 py-2.5 text-sm">Ôn từ vựng</Link>
                <Link href="/dashboard" className="rounded-full border border-white/20 px-5 py-2.5 text-sm">Tổng quan</Link>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- live room
  const speaking = agentState === 'speaking';
  const isDemo = session?.mode === 'demo';
  return (
    <div className="flex h-[100dvh] flex-col bg-[#1d2622] text-[#eef0ea]">
      {/* top bar */}
      <header className="flex items-center justify-between gap-3 px-3 py-2.5 md:px-5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium md:text-base">{lesson.titleVi} <span className="text-[#aab5ae]" lang="ja">· {lesson.title}</span></p>
          <p className="text-[11px] text-[#aab5ae]">
            {isDemo ? 'Chế độ demo' : connection === 'reconnecting' ? 'Đang kết nối lại…' : 'Đã kết nối'}
            {savedTerms.length > 0 && <span className="ml-2 inline-flex items-center gap-1"><BookmarkPlus size={11} />{savedTerms.length} từ đã lưu</span>}
          </p>
        </div>
        <div className={cn('mono flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1 text-sm', remaining <= 90 ? 'bg-[#d9534a]/20 text-[#ffb4ac]' : 'bg-white/5')} data-testid="session-timer">
          <Clock3 size={14} /> {clock(elapsed)} <span className="text-[#aab5ae]">/ {clock(maxSeconds)}</span>
        </div>
      </header>

      {notice && (
        <div className={cn('mx-3 mb-2 flex items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm md:mx-5', notice.tone === 'error' ? 'bg-[#d9534a]/20 text-[#ffcdc7]' : 'bg-[#e8c27f]/15 text-[#f3dcb2]')} role="status">
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Đóng"><X size={15} /></button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 px-3 md:flex-row md:px-5">
        {/* stage */}
        <div className="relative min-h-[38vh] flex-1 overflow-hidden rounded-2xl bg-[#121916] md:min-h-0">
          <div className={cn('absolute inset-0 transition', speaking && 'ring-4 ring-inset ring-[#8fc2ae]/70')}>
            <div ref={avatarHostRef} className={cn('absolute inset-0', !avatarEl && 'hidden')} />
            {!avatarEl && (
              <div className="absolute inset-0 grid place-items-center">
                <div className={cn('aspect-square h-[78%] max-h-[520px] overflow-hidden rounded-full transition-transform', speaking && 'scale-[1.02]')}>
                  <YukiPortrait speaking={speaking} />
                </div>
              </div>
            )}
          </div>
          <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-black/45 px-2.5 py-1 text-xs backdrop-blur">
            <span className={cn('size-2 rounded-full', speaking ? 'animate-pulse bg-[#8fc2ae]' : agentState === 'thinking' ? 'bg-[#e8c27f]' : 'bg-[#aab5ae]')} />
            Yuki-sensei · {speaking ? 'đang nói' : agentState === 'thinking' ? 'đang nghĩ…' : 'đang nghe'}
            {avatarStatus === 'fallback' && <span className="inline-flex items-center gap-1 text-[#f3dcb2]"><WifiOff size={11} /> ảnh tĩnh</span>}
          </div>

          {/* bilingual subtitles */}
          {captionsOn && subtitle && (subtitle.ja || subtitle.vi) && (
            <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-center md:bottom-5" aria-live="polite">
              <div className="max-w-3xl rounded-xl bg-black/70 px-4 py-2.5 text-center backdrop-blur" data-testid="subtitles">
                {subtitle.ja && <p className="text-lg leading-snug md:text-2xl" lang="ja">{subtitle.ja}</p>}
                {subtitle.vi && <p className="mt-0.5 text-sm text-[#d7ded9] md:text-base">{subtitle.vi}</p>}
              </div>
            </div>
          )}

          {/* learner camera (picture-in-picture) */}
          <div className="absolute right-3 top-3 aspect-[4/3] w-28 overflow-hidden rounded-xl border border-white/10 bg-[#26322e] shadow-lg md:w-44">
            {camOn ? (
              <video ref={camRef} autoPlay muted playsInline className="h-full w-full -scale-x-100 object-cover" />
            ) : (
              <div className="grid h-full w-full place-items-center text-xs text-[#aab5ae]"><span className="grid size-10 place-items-center rounded-full bg-[#426b5e] text-base text-white">Bạn</span></div>
            )}
            {!micOn && <span className="absolute bottom-1 right-1 rounded-full bg-black/60 p-1"><MicOff size={11} /></span>}
          </div>
        </div>

        {/* side panel */}
        {panelOpen && (
          <aside className="flex max-h-[46vh] min-h-0 w-full shrink-0 flex-col gap-2 md:max-h-none md:w-[380px] lg:w-[420px]">
            <div className="flex shrink-0 gap-1 rounded-full bg-[#26322e] p-1 text-sm">
              <button onClick={() => { setPanel('board'); setUnreadBoard(false); }} className={cn('relative flex-1 rounded-full py-1.5', panel === 'board' && 'bg-[#3d4d47] font-medium')} data-testid="tab-board">
                Bảng trắng{unreadBoard && <span className="absolute right-3 top-2 size-2 rounded-full bg-[#e8c27f]" />}
              </button>
              <button onClick={() => setPanel('chat')} className={cn('flex-1 rounded-full py-1.5', panel === 'chat' && 'bg-[#3d4d47] font-medium')} data-testid="tab-chat">Chat & transcript</button>
            </div>
            {panel === 'board' ? (
              <Whiteboard items={board} quiz={quiz} onSubmitQuiz={submitQuiz} className="flex-1" />
            ) : (
              <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl bg-[#26322e]">
                <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3 text-sm">
                  {transcript.length === 0 && <p className="p-4 text-center text-[#aab5ae]">Hội thoại sẽ hiện ở đây. Bạn có thể ngắt lời và hỏi bất cứ lúc nào — tiếng Việt hay tiếng Nhật đều được.</p>}
                  {transcript.map((t, i) => (
                    <div key={i} className={cn('flex', t.speaker === 'learner' && 'justify-end')}>
                      <p className={cn('max-w-[85%] rounded-2xl px-3 py-2', t.speaker === 'teacher' ? 'bg-[#33413c]' : 'bg-[#8fc2ae] text-[#1d2622]')} lang={t.language === 'ja' ? 'ja' : undefined}>{t.text}</p>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <form onSubmit={ask} className="flex shrink-0 gap-2 border-t border-white/5 p-2.5">
                  <input
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Hỏi Sensei… (VD: は đọc là gì?)"
                    className="min-w-0 flex-1 rounded-full bg-[#1d2622] px-4 py-2.5 text-sm outline-none ring-[#8fc2ae] placeholder:text-[#7d8a83] focus:ring-1"
                    data-testid="input-chat"
                  />
                  <button type="submit" disabled={!question.trim()} className="grid size-10 place-items-center rounded-full bg-[#8fc2ae] text-[#1d2622] disabled:opacity-40" aria-label="Gửi" data-testid="button-send-chat"><Send size={16} /></button>
                </form>
              </section>
            )}
            {board.length > 0 && panel === 'chat' && (
              <button onClick={() => setPanel('board')} className="flex shrink-0 items-center gap-3 rounded-xl bg-[#f6f1e4] px-3 py-2 text-left text-[#1f2f2a]">
                <span className="text-2xl" lang="ja"><Ruby kanji={board[0]!.kanji} kana={board[0]!.kana} /></span>
                <span className="truncate text-sm">{board[0]!.meaning_vi}</span>
              </button>
            )}
          </aside>
        )}
      </div>

      {/* control bar */}
      <footer className="flex items-center justify-center gap-1 overflow-x-auto px-2 py-3 sm:gap-2 md:gap-3 md:py-4">
        <ControlButton active={micOn} label={micOn ? 'Tắt mic' : 'Bật mic'} onClick={toggleMic} testId="button-mic">{micOn ? <Mic size={19} /> : <MicOff size={19} />}</ControlButton>
        <ControlButton active={camOn} label={camOn ? 'Tắt camera' : 'Bật camera'} onClick={toggleCam} testId="button-camera">{camOn ? <Video size={19} /> : <VideoOff size={19} />}</ControlButton>
        <ControlButton label="Giơ tay / ngắt lời" onClick={() => void send({ type: 'raise_hand' })} testId="button-raise-hand"><Hand size={19} /></ControlButton>
        <ControlButton label="Nhắc lại" onClick={() => void send({ type: 'repeat', slower: slow })} testId="button-repeat"><RotateCcw size={18} /></ControlButton>
        <ControlButton
          label={slow ? 'Tốc độ bình thường' : 'Nói chậm lại'}
          highlight={slow}
          onClick={async () => { if (await send({ type: 'slower', enabled: !slow })) setSlow(!slow); }}
          testId="button-slower"
        >
          <Snail size={19} />
        </ControlButton>
        <ControlButton label={captionsOn ? 'Tắt phụ đề' : 'Bật phụ đề'} active onClick={() => setCaptionsOn((v) => !v)} highlight={captionsOn} testId="button-captions">{captionsOn ? <Captions size={19} /> : <CaptionsOff size={19} />}</ControlButton>
        <ControlButton label="Bảng / chat" onClick={() => setPanelOpen((v) => !v)} testId="button-panel">{panel === 'chat' ? <MessageSquare size={18} /> : <PanelRight size={18} />}</ControlButton>
        <ControlButton danger label="Kết thúc buổi học" onClick={() => finishRef.current('user_ended')} testId="button-end"><PhoneOff size={19} /></ControlButton>
      </footer>
    </div>
  );
}

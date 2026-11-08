import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, FormEvent, ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { Room, RoomEvent } from 'livekit-client';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Link, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import {
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  Check,
  CircleHelp,
  Clock3,
  Headphones,
  LoaderCircle,
  Mic,
  MicOff,
  MessageCircle,
  MoreHorizontal,
  Play,
  RotateCcw,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  Waves,
  X,
} from 'lucide-react';
import {
  getGetVoiceStatusQueryKey,
  useFinishVoiceSession,
  useGetVoiceStatus,
  useStartVoiceSession,
} from '@workspace/api-client-react';
import type {
  FinishVoiceSessionInput,
  StartedVoiceSession,
  TranscriptEntry,
  VoiceStatus,
} from '@workspace/api-client-react';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#426b5e',
    colorForeground: '#263b34',
    colorMutedForeground: '#737e77',
    colorDanger: '#a64740',
    colorBackground: '#f8f5ec',
    colorInput: '#fffdf8',
    colorInputForeground: '#263b34',
    colorNeutral: '#263b34',
    fontFamily: 'DM Sans',
    borderRadius: '12px',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#f8f5ec] rounded-2xl w-[440px] max-w-full overflow-hidden',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#263b34] font-semibold',
    headerSubtitle: 'text-[#737e77]',
    socialButtonsBlockButtonText: 'text-[#263b34] font-medium',
    formFieldLabel: 'text-[#354b42] font-medium',
    footerActionLink: 'text-[#426b5e] font-semibold',
    footerActionText: 'text-[#737e77]',
    dividerText: 'text-[#737e77]',
    identityPreviewEditButton: 'text-[#426b5e]',
    formFieldSuccessText: 'text-[#426b5e]',
    alertText: 'text-[#8d433d]',
    logoBox: 'mb-2',
    logoImage: 'max-h-9',
    socialButtonsBlockButton: 'border-[#ddd8cc] bg-[#fffdf8] hover:bg-[#f0ede4]',
    formButtonPrimary: 'bg-[#426b5e] hover:bg-[#34584c] text-[#fbf8ef]',
    formFieldInput: 'border-[#d9d5ca] bg-[#fffdf8] text-[#263b34]',
    footerAction: 'border-t border-[#e2ded3]',
    dividerLine: 'bg-[#e2ded3]',
    alert: 'bg-[#f8e9e5] text-[#8d433d]',
    otpCodeFieldInput: 'border-[#d9d5ca] bg-[#fffdf8] text-[#263b34]',
    formFieldRow: 'mb-4',
    main: 'gap-5',
  },
};

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-mark ${compact ? 'brand-mark-small' : ''}`}>
      <span className="brand-sun">心</span>
      <span className="brand-name">sensei<span>.</span></span>
    </span>
  );
}

function TopNav() {
  return (
    <header className="site-nav">
      <Link href="/" className="nav-brand" data-testid="link-home-brand"><Brand /></Link>
      <nav className="nav-links" aria-label="Main navigation">
        <a href="#method">Our approach</a>
        <a href="#lesson">A lesson, up close</a>
      </nav>
      <div className="nav-actions">
        <Link href="/sign-in" className="nav-sign-in" data-testid="link-sign-in">Sign in</Link>
        <Link href="/sign-up" className="nav-cta" data-testid="link-sign-up">Try a lesson <ArrowRight size={15} /></Link>
      </div>
    </header>
  );
}

function LandingPage() {
  return (
    <div className="landing grain">
      <TopNav />
      <main>
        <section className="hero">
          <div className="hero-copy">
            <div className="eyebrow fade-up"><span className="eyebrow-dot" /> Japanese, one gentle conversation at a time</div>
            <h1 className="fade-up delay-1">A little Japanese.<br /><em>A lot more you.</em></h1>
            <p className="hero-intro fade-up delay-2">Short, one-on-one speaking lessons with a patient sensei — and clear Vietnamese explanations whenever you need them.</p>
            <div className="hero-actions fade-up delay-2">
              <Link href="/classroom" className="button-primary" data-testid="link-start-lesson">Step into class <ArrowRight size={17} /></Link>
              <span className="hero-note"><span className="note-line" /> About 10 minutes. At your pace.</span>
            </div>
            <div className="hero-proof"><div className="proof-avatars"><span>H</span><span>L</span><span>M</span></div><p>Made for Vietnamese learners<br /><b>starting with the everyday</b></p></div>
          </div>
          <div className="hero-art" aria-label="A quiet study nook illustrated in warm Japanese-inspired colors">
            <div className="art-sun" />
            <div className="art-paper art-paper-back"><span>こんにちは</span></div>
            <div className="art-window"><div className="window-bar vertical" /><div className="window-bar horizontal" /><div className="window-view"><i /><i /><i /></div></div>
            <div className="art-leaf leaf-a" /><div className="art-leaf leaf-b" /><div className="art-leaf leaf-c" />
            <div className="art-table" />
            <div className="art-teacup"><span /></div>
            <div className="art-paper art-paper-front"><small>LESSON 01</small><span>はじめまして</span><b>Hajimemashite</b><i>Rất vui được gặp bạn.</i></div>
            <div className="art-caption"><Waves size={15} /> a slower kind of fluency</div>
          </div>
          <div className="hero-index mono">01 / 04 <span /> LISTEN · TRY · GROW</div>
        </section>

        <section className="lesson-strip" id="lesson">
          <div className="strip-label mono">IN YOUR FIRST LESSON</div>
          <div className="strip-item"><span className="strip-number">01</span><div><b>Say hello, naturally</b><p>Start with a phrase you can use today.</p></div></div>
          <div className="strip-divider" />
          <div className="strip-item"><span className="strip-number">02</span><div><b>Understand every word</b><p>Explanations in Vietnamese, not jargon.</p></div></div>
          <div className="strip-divider" />
          <div className="strip-item"><span className="strip-number">03</span><div><b>Try again, no pressure</b><p>Repeat it slower whenever you like.</p></div></div>
        </section>

        <section className="method-section" id="method">
          <div className="method-aside"><div className="section-kicker mono">A BETTER RHYTHM</div><div className="method-decoration">ゆっくり<br /><i>yukkuri</i></div><p>Slowly. Gently. One small step at a time.</p></div>
          <div className="method-main"><p className="overline">LANGUAGE IS A HUMAN THING</p><h2>Not a quiz.<br /><em>A conversation.</em></h2><p className="method-description">Sensei listens first. You can ask for a repeat, take a breath, or type a question in the middle of a sentence. Nothing moves on until it makes sense to you.</p>
            <div className="method-values"><div><span className="value-icon"><Headphones size={18} /></span><b>One voice, just for you</b><p>No crowded classroom. No racing the clock.</p></div><div><span className="value-icon terracotta"><MessageCircle size={18} /></span><b>Vietnamese when it helps</b><p>Grammar made clear, without switching apps.</p></div></div>
          </div>
        </section>
        <section className="quote-band"><span className="quote-mark">“</span><blockquote>It is okay to pause.<br />That is part of learning.</blockquote><span className="quote-attribution mono">A NOTE FROM YOUR SENSEI</span><span className="quote-jp">大丈夫</span></section>
        <section className="closing-cta"><div><span className="overline">YOUR FIRST HELLO IS WAITING</span><h2>Shall we begin?</h2><p>Just you, your voice, and one kind sensei.</p></div><Link href="/classroom" className="button-primary" data-testid="link-classroom-bottom">Start your first lesson <ArrowRight size={17} /></Link></section>
      </main>
      <footer className="site-footer"><Link href="/" className="footer-brand"><Brand compact /></Link><span>Little by little, Japanese becomes yours.</span><Link href="/sign-in" className="footer-sign-in">Already learning? Sign in <ArrowRight size={14} /></Link></footer>
    </div>
  );
}

function formatTime(seconds: number) {
  const mins = Math.floor(seconds / 60).toString().padStart(2, '0');
  const secs = (seconds % 60).toString().padStart(2, '0');
  return `${mins}:${secs}`;
}

function ClassroomPage() {
  const queryClient = useQueryClient();
  const statusQuery = useGetVoiceStatus({ query: { queryKey: getGetVoiceStatusQueryKey() } });
  const startSession = useStartVoiceSession();
  const finishSession = useFinishVoiceSession();
  const [session, setSession] = useState<StartedVoiceSession | null>(null);
  const [connected, setConnected] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [micEnabled, setMicEnabled] = useState(false);
  const [slowMode, setSlowMode] = useState(false);
  const [question, setQuestion] = useState('');
  const [notice, setNotice] = useState('');
  const [finishing, setFinishing] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const startedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!connected) return;
    const timer = window.setInterval(() => {
      if (startedAt.current) setElapsed(Math.floor((Date.now() - startedAt.current) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [connected]);

  useEffect(() => () => {
    roomRef.current?.disconnect();
  }, []);

  const handleStart = async () => {
    setNotice('');
    try {
      const response = await startSession.mutateAsync({ data: { lessonId: 'n5-greetings-01' } });
      await queryClient.invalidateQueries({ queryKey: getGetVoiceStatusQueryKey() });
      setSession(response);
      const liveRoom = new Room({ adaptiveStream: true, dynacast: true });
      liveRoom.on(RoomEvent.DataReceived, (payload) => {
        try {
          const message = JSON.parse(new TextDecoder().decode(payload)) as { type?: string; text?: string; language?: string };
          if (message.type === 'caption' && typeof message.text === 'string' && message.text.trim()) {
            const entry: TranscriptEntry = {
              speaker: 'teacher',
              text: message.text,
              language: message.language === 'vi' || message.language === 'mixed'
                ? message.language
                : 'ja',
              elapsedMs: startedAt.current ? Date.now() - startedAt.current : 0,
            };
            setTranscript((current) => [...current, entry]);
          }
        } catch {
          // Ignore non-caption room data; only recognized captions become transcript.
        }
      });
      liveRoom.on(RoomEvent.TranscriptionReceived, (segments, participant) => {
        const speaker = participant?.identity === liveRoom.localParticipant.identity ? 'learner' : 'teacher';
        const receivedAt = startedAt.current ? Date.now() - startedAt.current : 0;
        const captions: TranscriptEntry[] = segments
          .filter((segment) => segment.final && segment.text.trim())
          .map((segment) => {
            const segmentLanguage = 'language' in segment ? segment.language : undefined;
            return {
              speaker,
              text: segment.text,
              language: segmentLanguage === 'ja' || segmentLanguage === 'vi' ? segmentLanguage : 'mixed',
              elapsedMs: receivedAt,
            };
          });
        if (captions.length) setTranscript((current) => [...current, ...captions]);
      });
      try {
        await liveRoom.connect(response.livekitUrl, response.participantToken);
        roomRef.current = liveRoom;
        setRoom(liveRoom);
        setConnected(true);
        startedAt.current = Date.now();
        setNotice('');
      } catch (error) {
        liveRoom.disconnect();
        setSession(null);
        setNotice(error instanceof Error ? `The room could not connect: ${error.message}` : 'The room could not connect. Please try again.');
      }
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'We could not start this lesson just now.');
    }
  };

  const sendRoomAction = async (payload: { type: string; text?: string; slower?: boolean; enabled?: boolean }) => {
    if (!room || !connected) return false;
    try {
      await room.localParticipant.publishData(new TextEncoder().encode(JSON.stringify(payload)), { reliable: true });
      return true;
    } catch {
      setNotice('That did not reach your sensei. Please try once more.');
      return false;
    }
  };

  const setMicrophone = async () => {
    if (!room || !connected) return;
    try {
      await room.localParticipant.setMicrophoneEnabled(!micEnabled);
      setMicEnabled(!micEnabled);
    } catch {
      setNotice('Microphone access is unavailable. Check your browser permissions.');
    }
  };

  const finishLesson = async () => {
    if (!session || !connected || finishing) return;
    setFinishing(true);
    setNotice('');
    const payload: FinishVoiceSessionInput = {
      durationSeconds: Math.min(3600, elapsed),
      transcript,
      summary: null,
      commonMistakes: [],
    };
    try {
      await finishSession.mutateAsync({ sessionId: session.sessionId, data: payload });
      await queryClient.invalidateQueries({ queryKey: getGetVoiceStatusQueryKey() });
      await room?.disconnect();
      setConnected(false);
      roomRef.current = null;
      setRoom(null);
      setMicEnabled(false);
      setSession(null);
      setNotice('Lesson saved. You did something good for your Japanese today.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Your lesson could not be saved. Please try again.');
    } finally {
      setFinishing(false);
    }
  };

  const sendQuestion = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = question.trim();
    if (!text || !connected) return;
    if (await sendRoomAction({ type: 'interruption', text })) {
      const hasJapanese = /[\u3040-\u30ff\u3400-\u9fff]/u.test(text);
      const hasVietnamese = /[ăâđêôơưàáạảãằắặẳẵèéẹẻẽìíịỉĩòóọỏõùúụủũỳýỵỷỹ]/iu.test(text);
      const language = hasJapanese && hasVietnamese
        ? 'mixed'
        : hasJapanese
          ? 'ja'
          : 'vi';
      setTranscript((current) => [...current, { speaker: 'learner', text, language, elapsedMs: elapsed * 1000 }]);
      setQuestion('');
      setNotice('');
    }
  };

  const handleRepeat = async () => {
    if (await sendRoomAction({ type: 'repeat', slower: slowMode })) setNotice(slowMode ? 'Asked Sensei to repeat that slowly.' : 'Asked Sensei to repeat that.');
  };
  const handleSlower = async () => {
    const next = !slowMode;
    if (await sendRoomAction({ type: 'slower', enabled: next })) {
      setSlowMode(next);
      setNotice(next ? 'Slower pace is on.' : 'Back to the usual pace.');
    }
  };

  const status = statusQuery.data as VoiceStatus | undefined;
  const unavailable = statusQuery.isSuccess && !status?.available;
  const isBusy = startSession.isPending || connected || finishing;

  return (
    <div className="classroom-shell">
      <header className="classroom-nav">
        <Link href="/" className="classroom-back" data-testid="link-back-home"><ArrowLeft size={17} /><span>Leave lesson room</span></Link>
        <Link href="/" className="classroom-brand" data-testid="link-classroom-brand"><Brand compact /></Link>
        <div className="nav-session-meta"><span className={`connection-dot ${connected ? 'is-live' : ''}`} />{connected ? 'Connected' : 'N5 · Beginner'}</div>
      </header>
      <main className="classroom-main">
        <div className="classroom-heading">
          <div><div className="lesson-eyebrow mono">LESSON 01 <span>·</span> N5 BEGINNER</div><h1>Let’s say hello.</h1><p>A warm-up for your very first introduction.</p></div>
          <div className="session-clock"><Clock3 size={16} /><span className="mono">{formatTime(elapsed)}</span><span className="clock-label">{connected ? 'IN CLASS' : 'READY WHEN YOU ARE'}</span></div>
        </div>
        <div className="classroom-grid">
          <section className="lesson-stage">
            <div className={`teacher-scene ${connected ? 'teacher-connected' : ''}`}>
              <div className="scene-halo" />
              <div className="teacher-avatar"><span>心</span><i /></div>
              <div className="teacher-caption">
                <div className="caption-name"><span className={`connection-dot ${connected ? 'is-live' : ''}`} />{connected ? 'Sensei is listening' : 'Your sensei is here'}</div>
                <h2>{connected ? 'ゆっくりで大丈夫。' : 'はじめまして。'}</h2>
                <p>{connected ? 'Yukkuri de daijōbu.' : 'Hajimemashite.'}</p>
                <div className="caption-translation"><span>VI</span>{connected ? 'Bạn cứ từ từ nhé.' : 'Rất vui được gặp bạn.'}</div>
              </div>
              <div className="sound-wave" aria-hidden={!connected}>{Array.from({ length: 25 }, (_, index) => <i key={index} style={{ '--bar': `${8 + ((index * 19) % 28)}px` } as CSSProperties} />)}</div>
              <div className="scene-scribble">こんにちは</div>
            </div>
            <div className="connection-state" role="status" data-testid="status-voice-connection">
              {statusQuery.isLoading && <><span className="loading-pulse" /><span>Checking your lesson room…</span></>}
              {statusQuery.isError && <><CircleHelp size={17} /><span>We couldn’t check the voice room.</span><button onClick={() => statusQuery.refetch()} data-testid="button-retry-status">Try again</button></>}
              {unavailable && <><span className="state-symbol"><Settings2 size={15} /></span><span>Voice lessons are not configured yet.</span><small>{status?.missingProviders?.length ? `Waiting for ${status.missingProviders.join(' and ')} setup.` : 'Please check back soon.'}</small></>}
              {status?.available && !connected && !startSession.isPending && <><span className="state-symbol ready"><Check size={15} /></span><span>Your room is ready.</span><small>Your lesson starts only after a secure connection is made.</small></>}
              {startSession.isPending && <><LoaderCircle size={16} className="spin" /><span>Preparing your private room…</span></>}
              {connected && <><span className="connection-dot is-live" /><span>You’re connected to your sensei.</span><small>Your captions appear here when they arrive.</small></>}
            </div>
            {notice && <div className={`classroom-notice ${notice.includes('could not') || notice.includes('unavailable') ? 'notice-error' : ''}`} role="status" data-testid="status-lesson-notice"><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}
            <div className="lesson-controls">
              <button className={`mic-button ${!micEnabled ? 'mic-muted' : ''}`} onClick={setMicrophone} disabled={!connected} aria-label={micEnabled ? 'Mute microphone' : 'Turn microphone on'} data-testid="button-microphone">
                {micEnabled ? <Mic size={19} /> : <MicOff size={19} />}<span>{micEnabled ? 'Mic on' : 'Mic off'}</span>
              </button>
              {!connected ? <button className="begin-button" onClick={handleStart} disabled={!status?.available || isBusy} data-testid="button-begin-lesson"><Play size={16} fill="currentColor" />Begin lesson</button> : <button className="end-button" onClick={finishLesson} disabled={finishing} data-testid="button-finish-lesson">{finishing ? <LoaderCircle size={16} className="spin" /> : <X size={16} />}{finishing ? 'Saving lesson' : 'End lesson'}</button>}
              <button className="control-more" onClick={() => setNotice('Take your time. Your lesson will wait for you.')} aria-label="Lesson help" data-testid="button-lesson-help"><MoreHorizontal size={20} /></button>
            </div>
          </section>
          <aside className="lesson-side">
            <div className="side-title"><div><span className="overline">YOUR PRACTICE</span><h3>Say it together</h3></div><span className="practice-count mono">01 <i>/ 03</i></span></div>
            <div className="practice-card">
              <span className="practice-label mono">FIRST INTRODUCTION</span><div className="practice-japanese">はじめまして。</div><div className="practice-romaji">Hajimemashite.</div>
              <p>A polite way to say “Nice to meet you” when you meet someone for the first time.</p>
              <div className="practice-vietnamese"><span>VIETNAMESE NOTE</span><b>“Rất vui được gặp bạn”</b><small>Use this when introducing yourself.</small></div>
              <div className="practice-actions">
                <button onClick={handleRepeat} disabled={!connected} data-testid="button-repeat"><RotateCcw size={15} />Repeat</button>
                <button onClick={handleSlower} disabled={!connected} className={slowMode ? 'active-tool' : ''} data-testid="button-slower"><Volume2 size={16} />{slowMode ? 'Slower on' : 'Slower'}</button>
              </div>
            </div>
            <div className="question-card">
              <div className="question-title"><span><MessageCircle size={16} /></span><div><b>Need to ask something?</b><small>Interrupt anytime — in Vietnamese is fine.</small></div></div>
              <form onSubmit={sendQuestion}><input aria-label="Ask a question in Vietnamese" placeholder="Type a quick question…" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={!connected} data-testid="input-lesson-question" /><button type="submit" aria-label="Send question" disabled={!connected || !question.trim()} data-testid="button-send-question"><Send size={16} /></button></form>
              <div className="question-foot"><span className={`connection-dot ${connected ? 'is-live' : ''}`} />{connected ? 'Your sensei will see it' : 'Connect to ask a question'}</div>
            </div>
          </aside>
        </div>
        <section className="transcript-panel">
          <div className="transcript-heading"><div><span className="overline">AS WE GO</span><h3>Lesson notes</h3></div><button onClick={() => setTranscript([])} disabled={!transcript.length} data-testid="button-clear-captions">Clear notes</button></div>
          {transcript.length === 0 ? <div className="transcript-empty"><span className="empty-wave"><AudioLines size={19} /></span><div><b>{connected ? 'Your conversation will appear here.' : 'Your captions will find a home here.'}</b><p>Japanese words and Vietnamese explanations, together in one place.</p></div></div> : <div className="transcript-list" aria-live="polite">{transcript.map((entry, index) => <div className={`transcript-entry ${entry.speaker === 'learner' ? 'learner-entry' : ''}`} key={`${entry.elapsedMs}-${index}`} data-testid={`transcript-entry-${index}`}><span className="transcript-time mono">{formatTime(Math.floor(entry.elapsedMs / 1000))}</span><span className={`speaker-tag ${entry.speaker}`}>{entry.speaker === 'teacher' ? 'SENSEI' : 'YOU'}</span><span>{entry.text}</span><span className="language-tag mono">{entry.language.toUpperCase()}</span></div>)}</div>}
        </section>
        <div className="classroom-footer"><span><Sparkles size={14} /> A small step still counts.</span><button onClick={() => setNotice('We’re glad you’re here. Every lesson begins with a first word.')} data-testid="button-encouragement">A note from Sensei <ArrowDownLeft size={14} /></button></div>
      </main>
    </div>
  );
}

function SignInPage() {
  return <div className="auth-page"><div className="auth-backdrop"><div className="auth-orbit" /><div className="auth-kanji">学</div></div><div className="auth-top"><Link href="/" data-testid="link-auth-home"><Brand /></Link><span>Small lessons. Real progress.</span></div><div className="auth-content"><p className="mono">YOUR NEXT CHAPTER</p><h1>Welcome back<br /><em>to the conversation.</em></h1><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div><p className="auth-bottom">A patient space to find your Japanese voice.</p></div>;
}

function SignUpPage() {
  return <div className="auth-page"><div className="auth-backdrop"><div className="auth-orbit" /><div className="auth-kanji">芽</div></div><div className="auth-top"><Link href="/" data-testid="link-auth-home"><Brand /></Link><span>A good place to begin.</span></div><div className="auth-content"><p className="mono">YOUR FIRST SMALL STEP</p><h1>Begin with<br /><em>konnichiwa.</em></h1><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div><p className="auth-bottom">There is no perfect time to start. There is just now.</p></div>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const userId = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== userId) client.clear();
    previous.current = userId;
  }), [addListener, client]);
  return null;
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Pick up where your Japanese left off.' } }, signUp: { start: { title: 'Create your learning space', subtitle: 'Your first Japanese conversation is close.' } } }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <ClerkQueryClientCacheInvalidator />
          <RoutedErrorBoundary>
            <Switch>
              <Route path="/" component={LandingPage} />
              <Route path="/classroom" component={ClassroomPage} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route component={NotFound} />
            </Switch>
          </RoutedErrorBoundary>
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <WouterRouter base={basePath}><ClerkRoutes /></WouterRouter>;
}

export default App;

import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { ClerkProvider, SignIn, SignUp, UserButton, useAuth, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { useQueryClient } from '@tanstack/react-query';
import { Link, Redirect, useLocation } from 'wouter';
import { ArrowRight, FlaskConical } from 'lucide-react';
import { Brand } from '@/pages/landing';

export const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

/**
 * Auth is Clerk (Google login enabled in the Clerk dashboard) when a publishable
 * key is configured. Without one the app runs in local "demo" mode with a single
 * learner so it can be previewed without any accounts. The API enforces the same.
 */
const clerkPubKey: string | undefined = (() => {
  // publishableKeyFromHost derives a key from the hostname on Replit-managed Clerk,
  // so only use it when a key (or explicit opt-in) is configured.
  if (!import.meta.env.VITE_CLERK_PUBLISHABLE_KEY && import.meta.env.VITE_AUTH_MODE !== 'clerk') return undefined;
  try {
    return publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY) || undefined;
  } catch {
    return undefined;
  }
})();
export const authEnabled = Boolean(clerkPubKey);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
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
    formButtonPrimary: 'bg-[#426b5e] hover:bg-[#34584c] text-[#fbf8ef]',
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(
    () =>
      addListener(({ user }) => {
        const userId = user?.id ?? null;
        if (previous.current !== undefined && previous.current !== userId) client.clear();
        previous.current = userId;
      }),
    [addListener, client],
  );
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  if (!authEnabled) return <>{children}</>;
  return (
    <ClerkProvider
      publishableKey={clerkPubKey!}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      afterSignOutUrl={`${basePath}/`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <ClerkQueryClientCacheInvalidator />
      {children}
    </ClerkProvider>
  );
}

function ClerkGate({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Đang tải…</div>;
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <>{children}</>;
}

export function RequireAuth({ children }: { children: ReactNode }) {
  return authEnabled ? <ClerkGate>{children}</ClerkGate> : <>{children}</>;
}

export function UserMenu() {
  if (authEnabled) return <UserButton />;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-amber-300/60 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800"
      title="Chưa cấu hình Clerk — đang dùng tài khoản demo cục bộ"
    >
      <FlaskConical size={13} /> Demo
    </span>
  );
}

function DemoSignIn() {
  return (
    <div className="mx-auto w-full max-w-md rounded-2xl border bg-card p-7 text-left shadow-sm">
      <h2 className="text-xl font-semibold">Chế độ demo</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        Đăng nhập Google (qua Clerk) chưa được cấu hình. Bạn có thể vào học ngay bằng tài khoản demo cục bộ.
        Xem README để bật đăng nhập thật.
      </p>
      <Link
        href="/dashboard"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 font-medium text-primary-foreground"
        data-testid="button-demo-enter"
      >
        Vào học với tài khoản demo <ArrowRight size={16} />
      </Link>
    </div>
  );
}

function AuthFrame({ kanji, eyebrow, title, children }: { kanji: string; eyebrow: string; title: ReactNode; children: ReactNode }) {
  return (
    <div className="auth-page">
      <div className="auth-backdrop"><div className="auth-orbit" /><div className="auth-kanji">{kanji}</div></div>
      <div className="auth-top"><Link href="/" data-testid="link-auth-home"><Brand /></Link><span>Học ít mỗi ngày. Tiến bộ thật.</span></div>
      <div className="auth-content"><p className="mono">{eyebrow}</p><h1>{title}</h1>{children}</div>
      <p className="auth-bottom">Một không gian kiên nhẫn để bạn tìm thấy giọng nói tiếng Nhật của mình.</p>
    </div>
  );
}

export function SignInPage() {
  return (
    <AuthFrame kanji="学" eyebrow="CHÀO MỪNG TRỞ LẠI" title={<>Tiếp tục<br /><em>cuộc trò chuyện.</em></>}>
      {authEnabled ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} forceRedirectUrl={`${basePath}/dashboard`} /> : <DemoSignIn />}
    </AuthFrame>
  );
}

export function SignUpPage() {
  return (
    <AuthFrame kanji="芽" eyebrow="BƯỚC NHỎ ĐẦU TIÊN" title={<>Bắt đầu với<br /><em>konnichiwa.</em></>}>
      {authEnabled ? <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} forceRedirectUrl={`${basePath}/dashboard`} /> : <DemoSignIn />}
    </AuthFrame>
  );
}

import type { ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, RequireAuth, SignInPage, SignUpPage, basePath } from '@/lib/auth';
import LandingPage from '@/pages/landing';
import DashboardPage from '@/pages/dashboard';
import LessonsPage from '@/pages/lessons';
import ClassroomPage from '@/pages/classroom';
import NotebookPage from '@/pages/notebook';
import { HistoryDetailPage, HistoryListPage } from '@/pages/history';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: 1 } } });

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function Protected({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>;
}

function Routes() {
  return (
    <Switch>
      <Route path="/" component={LandingPage} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route path="/dashboard"><Protected><DashboardPage /></Protected></Route>
      <Route path="/lessons"><Protected><LessonsPage /></Protected></Route>
      <Route path="/classroom"><Redirect to="/lessons" /></Route>
      <Route path="/classroom/:lessonId"><Protected><ClassroomPage /></Protected></Route>
      <Route path="/notebook"><Protected><NotebookPage /></Protected></Route>
      <Route path="/history"><Protected><HistoryListPage /></Protected></Route>
      <Route path="/history/:sessionId"><Protected><HistoryDetailPage /></Protected></Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <TooltipProvider>
            <RoutedErrorBoundary>
              <Routes />
            </RoutedErrorBoundary>
            <Toaster />
          </TooltipProvider>
        </AuthProvider>
      </QueryClientProvider>
    </WouterRouter>
  );
}

export default App;

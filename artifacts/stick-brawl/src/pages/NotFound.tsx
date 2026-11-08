import { useLocation } from 'wouter';

import { Page } from '@/components/Layout';
import { StickFigure } from '@/components/StickFigure';
import { Button } from '@/components/ui';

export default function NotFound() {
  const [, nav] = useLocation();
  return (
    <Page className="flex flex-col items-center text-center">
      <div className="h-56 w-56">
        <StickFigure pose="ko" color="var(--ink)" />
      </div>
      <h1 className="font-display text-5xl">404</h1>
      <p className="mt-2 text-xl text-ink-soft">Trang này bị đánh gục mất rồi.</p>
      <Button variant="red" className="mt-6" onClick={() => nav('/')}>
        Về trang chủ
      </Button>
    </Page>
  );
}

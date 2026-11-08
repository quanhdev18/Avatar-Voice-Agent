import { Link } from 'wouter';
import { ArrowRight, Headphones, MessageCircle, Waves } from 'lucide-react';

export function Brand({ compact = false }: { compact?: boolean }) {
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

export default function LandingPage() {
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
              <Link href="/dashboard" className="button-primary" data-testid="link-start-lesson">Step into class <ArrowRight size={17} /></Link>
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
        <section className="closing-cta"><div><span className="overline">YOUR FIRST HELLO IS WAITING</span><h2>Shall we begin?</h2><p>Just you, your voice, and one kind sensei.</p></div><Link href="/dashboard" className="button-primary" data-testid="link-classroom-bottom">Start your first lesson <ArrowRight size={17} /></Link></section>
      </main>
      <footer className="site-footer"><Link href="/" className="footer-brand"><Brand compact /></Link><span>Little by little, Japanese becomes yours.</span><Link href="/sign-in" className="footer-sign-in">Already learning? Sign in <ArrowRight size={14} /></Link></footer>
    </div>
  );
}


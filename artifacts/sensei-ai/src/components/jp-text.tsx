/** Kanji with furigana (ruby). Falls back to plain kana when there is no kanji. */
export function Ruby({ kanji, kana, className }: { kanji?: string | null; kana: string; className?: string }) {
  if (!kanji || kanji === kana) return <span className={className} lang="ja">{kana}</span>;
  return (
    <ruby className={className} lang="ja">
      {kanji}
      <rp>(</rp>
      <rt className="text-[0.38em] font-normal tracking-wide text-muted-foreground">{kana}</rt>
      <rp>)</rp>
    </ruby>
  );
}

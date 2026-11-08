/**
 * Still portrait of Yuki-sensei. Used before the avatar video arrives and as the
 * fallback when the avatar provider disconnects (voice-only + still image).
 * The mouth animates while the teacher is speaking.
 */
export function YukiPortrait({ speaking }: { speaking: boolean }) {
  return (
    <svg viewBox="0 0 400 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" role="img" aria-label="Yuki-sensei">
      <defs>
        <radialGradient id="yk-bg" cx="50%" cy="38%" r="75%">
          <stop offset="0%" stopColor="#3f5f55" />
          <stop offset="100%" stopColor="#1d2c27" />
        </radialGradient>
        <linearGradient id="yk-hair" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#2a211d" />
          <stop offset="100%" stopColor="#15100e" />
        </linearGradient>
        <linearGradient id="yk-skin" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#f6d9c2" />
          <stop offset="100%" stopColor="#ebc3a6" />
        </linearGradient>
      </defs>
      <rect width="400" height="400" fill="url(#yk-bg)" />
      <circle cx="320" cy="80" r="46" fill="#e8a27f" opacity=".18" />
      {/* shoulders / cardigan */}
      <path d="M70 400 C80 315 140 285 200 285 C260 285 320 315 330 400 Z" fill="#c98a6b" />
      <path d="M160 292 L200 352 L240 292 C228 288 214 286 200 286 C186 286 172 288 160 292Z" fill="#f4efe6" />
      <path d="M200 352 L190 400 L210 400 Z" fill="#a8705a" />
      {/* neck */}
      <path d="M180 250 L180 292 Q200 304 220 292 L220 250 Z" fill="#e3b597" />
      {/* hair back */}
      <path d="M112 180 C108 100 160 62 204 62 C256 62 296 104 290 182 L294 262 C270 276 246 270 236 262 L166 262 C150 272 126 272 108 260 Z" fill="url(#yk-hair)" />
      {/* face */}
      <ellipse cx="200" cy="178" rx="70" ry="82" fill="url(#yk-skin)" />
      {/* fringe */}
      <path d="M128 168 C126 112 164 88 204 88 C246 88 276 116 274 166 C258 140 236 126 214 122 C196 138 166 150 128 168Z" fill="url(#yk-hair)" />
      {/* brows */}
      <path d="M160 156 Q174 150 186 155" stroke="#3a2a22" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      <path d="M214 155 Q226 150 240 156" stroke="#3a2a22" strokeWidth="3.5" fill="none" strokeLinecap="round" />
      {/* eyes (blink) */}
      <g className="yuki-eyes">
        <ellipse cx="173" cy="178" rx="8" ry="9" fill="#2a1d18" />
        <ellipse cx="227" cy="178" rx="8" ry="9" fill="#2a1d18" />
        <circle cx="176" cy="175" r="2.4" fill="#fff" />
        <circle cx="230" cy="175" r="2.4" fill="#fff" />
      </g>
      {/* glasses */}
      <g stroke="#6b4b3c" strokeWidth="2.5" fill="none" opacity=".85">
        <rect x="152" y="162" width="42" height="32" rx="12" />
        <rect x="206" y="162" width="42" height="32" rx="12" />
        <path d="M194 176 Q200 172 206 176" />
      </g>
      {/* blush */}
      <ellipse cx="160" cy="210" rx="12" ry="6" fill="#e89a86" opacity=".35" />
      <ellipse cx="240" cy="210" rx="12" ry="6" fill="#e89a86" opacity=".35" />
      {/* nose */}
      <path d="M200 192 Q196 206 202 210" stroke="#c99478" strokeWidth="2.5" fill="none" strokeLinecap="round" />
      {/* mouth */}
      <g className={speaking ? 'yuki-mouth-talk' : ''} style={{ transformOrigin: '200px 228px' }}>
        <path d="M184 226 Q200 238 216 226 Q200 232 184 226Z" fill="#b5534d" />
        <ellipse className="yuki-mouth-open" cx="200" cy="230" rx="11" ry="0" fill="#7d2e2b" />
      </g>
      {/* hair clip */}
      <rect x="244" y="112" width="22" height="8" rx="4" fill="#e8a27f" transform="rotate(28 255 116)" />
    </svg>
  );
}

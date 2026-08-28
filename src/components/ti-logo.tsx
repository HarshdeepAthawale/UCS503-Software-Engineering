/**
 * Thapar "ti" lettermark (mark only — no wordmark), recreated as a self-contained
 * SVG so it scales crisply, respects the CSP, and needs no external asset. Bold
 * rounded strokes in the institute's red→maroon gradient, with the signature
 * swoosh foot on the "t".
 */
export function TiLogo({ size = 34, className }: { size?: number; className?: string }) {
  // Unique gradient id per instance so multiple logos on a page don't collide.
  const gid = `ti-grad-${size}`;
  return (
    <svg
      width={size}
      height={(size * 140) / 120}
      viewBox="0 0 120 140"
      className={className}
      role="img"
      aria-label="Thapar Institute"
      fill="none"
    >
      <defs>
        <linearGradient id={gid} x1="12" y1="6" x2="104" y2="128" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff5a45" />
          <stop offset="0.45" stopColor="#e11d2a" />
          <stop offset="1" stopColor="#7a1f2b" />
        </linearGradient>
      </defs>
      {/* t — stem with the swoosh foot curving right */}
      <path
        d="M47 15 V92 Q47 116 71 116"
        stroke={`url(#${gid})`}
        strokeWidth="17"
        strokeLinecap="round"
      />
      {/* t — crossbar */}
      <path d="M24 50 H71" stroke={`url(#${gid})`} strokeWidth="15" strokeLinecap="round" />
      {/* i — stem */}
      <path d="M93 55 V116" stroke={`url(#${gid})`} strokeWidth="17" strokeLinecap="round" />
      {/* i — tittle (dot) */}
      <circle cx="93" cy="28" r="10.5" fill={`url(#${gid})`} />
    </svg>
  );
}

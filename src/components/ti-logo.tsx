/**
 * Thapar "ti" lettermark (mark only - no wordmark), recreated as a self-contained
 * SVG so it scales crisply, respects the CSP, and needs no external asset.
 * Monochrome: strokes use `currentColor`, so it renders ink on light and white
 * on dark automatically - matching the black-and-white design system.
 */
export function TiLogo({ size = 34, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={(size * 140) / 130}
      viewBox="0 0 130 140"
      className={className}
      role="img"
      aria-label="Thapar Institute"
      fill="none"
    >
      {/* t - heavy stem curving into a wide J-hook foot */}
      <path
        d="M42 14 V96 Q42 122 68 122 Q80 122 86 116"
        stroke="currentColor"
        strokeWidth="22"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* t - crossbar, extending to the right of the stem only */}
      <path d="M42 52 H82" stroke="currentColor" strokeWidth="20" strokeLinecap="round" />
      {/* i - stem */}
      <path d="M104 60 V112" stroke="currentColor" strokeWidth="21" strokeLinecap="round" />
      {/* i - tittle (dot), clearly separated */}
      <circle cx="104" cy="26" r="12" fill="currentColor" />
    </svg>
  );
}

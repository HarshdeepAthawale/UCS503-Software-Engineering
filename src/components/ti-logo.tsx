import Image from "next/image";

/**
 * The official Thapar Institute "ti" lettermark.
 *
 * This replaced a hand-drawn SVG approximation that stroked paths with
 * `currentColor`, so it rendered as a flat monochrome silhouette. The real mark
 * is a red gradient and is reproduced here rather than redrawn - an
 * institutional logo is not something to approximate.
 *
 * **`size` is the HEIGHT, not the width.** The old component took `size` as a
 * width and derived a near-square height from a 130x140 viewBox. The real mark
 * is markedly taller than it is wide (192x273), so keeping `size` as the width
 * would have made every existing call site about 40% taller and broken the nav
 * lockup. Height is also the dimension that matters for a mark sitting in a
 * fixed-height bar.
 *
 * The asset is a transparent PNG extracted from a white-background JPEG, so it
 * composites correctly on both the warm paper and the near-black canvas. It
 * carries its own colour and deliberately does NOT follow `--logo-invert`: a
 * gradient cannot be inverted the way a monochrome mark can, and this one holds
 * enough contrast on either ground.
 */

// Intrinsic size of public/ti-logo.png, cropped to the mark's own bounds.
const NATURAL = { width: 192, height: 273 };
const RATIO = NATURAL.width / NATURAL.height;

export function TiLogo({
  size = 34,
  className,
  priority = false,
}: {
  /** Rendered height in px. Width follows the mark's aspect ratio. */
  size?: number;
  className?: string;
  /** Set on above-the-fold marks so the nav does not pop in. */
  priority?: boolean;
}) {
  const width = Math.round(size * RATIO);
  return (
    <Image
      src="/ti-logo.png"
      alt="Thapar Institute"
      width={width}
      height={size}
      priority={priority}
      className={className}
      // Quality is raised from the default 75 because this is a small gradient
      // mark: JPEG-style ringing that is invisible on a photograph shows up as
      // a dirty edge on a 21px logo.
      quality={90}
      // Deliberately NO `sizes` prop. `sizes` is for responsive and `fill`
      // images; on a fixed width/height image it overrides Next's automatic
      // 1x/2x srcset and pins the request to a single CSS-pixel width. Setting
      // it here served a 21-pixel-wide file, which is exactly one device pixel
      // per CSS pixel and visibly soft on any retina screen. Without it Next
      // emits both 1x and 2x candidates and the browser picks.
    />
  );
}

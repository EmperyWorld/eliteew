/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Empery / EliteEW wordmark image for public landing chrome (header + footer).
 *
 * Invariants:
 * - Asset is `public/logo_empery.png` (same source as favicon / apple-icon).
 * - Serve via plain `<img>` — edge nginx 404s Next `/_next/image` optimizer on eliteew.ru;
 *   static `/logo_empery.png` is OK.
 * - Decorative when paired with visible product name; otherwise needs alt text.
 *
 * Related:
 * - SiteHeader.tsx · SiteFooter.tsx
 * - documentation/product/SITE-PROD-LANDING.md
 */

export const BRAND_LOGO = {
  src: "/logo_empery.png",
  alt: "EliteEW · Empery World",
  /** Intrinsic asset size (square PNG). */
  intrinsic: 256,
} as const;

type BrandLogoProps = {
  size?: number;
  className?: string;
  /** When true, image is decorative (name shown beside it). */
  decorative?: boolean;
};

export function BrandLogo({
  size = 40,
  className,
  decorative = false,
}: BrandLogoProps) {
  return (
    // Plain <img>: public edge 404s Next `/_next/image` on eliteew.ru; static PNG is OK.
    <img
      src={BRAND_LOGO.src}
      alt={decorative ? "" : BRAND_LOGO.alt}
      width={size}
      height={size}
      decoding="async"
      className={["shrink-0 object-contain", className].filter(Boolean).join(" ")}
      aria-hidden={decorative || undefined}
    />
  );
}

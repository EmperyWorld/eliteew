/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Reusable vertical section shell with consistent spacing and optional glass surface.
 *
 * Invariants:
 * - Mobile-first padding; id used for in-page CTA anchors.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md
 */

import type { ReactNode } from "react";

type SectionProps = {
  id: string;
  children: ReactNode;
  className?: string;
  glass?: boolean;
};

export function Section({ id, children, className = "", glass = false }: SectionProps) {
  return (
    <section
      id={id}
      className={[
        "relative mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-20 lg:px-8",
        glass
          ? "rounded-2xl border border-white/10 bg-(--color-surface) backdrop-blur-md"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </section>
  );
}

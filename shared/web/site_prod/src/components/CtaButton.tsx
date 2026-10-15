/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * CTA anchor button for mid-funnel intents (quiz / demo / poc / roi / tco).
 *
 * Invariants:
 * - Intent is data-attribute for analytics; href stays in-page until forms land.
 *
 * Related:
 * - documentation/product/SITE-PROD-LANDING.md §CTA ladder
 */

import type { CtaSpec } from "@/content/types";

type CtaButtonProps = {
  cta: CtaSpec;
  className?: string;
};

export function CtaButton({ cta, className = "" }: CtaButtonProps) {
  const base =
    "inline-flex items-center justify-center rounded-lg px-5 py-3 text-sm font-medium transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-accent)";
  const variants = {
    primary:
      "bg-(--color-cta) text-(--color-bg) hover:brightness-110 shadow-[0_0_24px_rgba(0,242,255,0.25)]",
    secondary:
      "border border-white/20 bg-transparent text-(--color-fg) hover:border-(--color-accent) hover:text-(--color-accent)",
  };

  return (
    <a
      href={cta.href}
      data-lead-intent={cta.intent}
      className={`${base} ${variants[cta.variant]} ${className}`}
    >
      {cta.label}
    </a>
  );
}

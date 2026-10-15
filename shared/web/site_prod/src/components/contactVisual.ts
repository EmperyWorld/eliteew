/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for combined contact pack (#contact) interest cards.
 *
 * Invariants:
 * - Four interests match leadBundle; no SLA / absolute security claims.
 *
 * Related:
 * - CombinedLeadSection.tsx
 * - leadBundle.ts · content/contact.ts
 */

import type { LeadInterest } from "@/lib/leadSchema";

export type ContactInterestTone = "demo" | "poc" | "roi" | "tco";

export type ContactInterestVisual = {
  step: string;
  tone: ContactInterestTone;
};

export const CONTACT_INTEREST_VISUAL: Record<
  LeadInterest,
  ContactInterestVisual
> = {
  demo: { step: "01", tone: "demo" },
  poc: { step: "02", tone: "poc" },
  roi: { step: "03", tone: "roi" },
  tco_table: { step: "04", tone: "tco" },
};

export const CONTACT_META = {
  ladderHint: "один POST · demo · PoC · ROI · TCO",
  packEyebrow: "Пакет запроса",
  fieldsEyebrow: "Контакт · sticky",
  submitEyebrow: "Один комбинированный POST",
} as const;

export function contactInterestToneClass(
  tone: ContactInterestTone,
  on: boolean,
): { card: string; icon: string; badge: string } {
  if (!on) {
    return {
      card: "border-white/10 bg-black/25 hover:border-white/25",
      icon: "border-white/12 bg-white/5 text-white/50",
      badge: "border-white/12 bg-black/30 text-white/40",
    };
  }
  switch (tone) {
    case "demo":
      return {
        card: "border-cyan-300/40 bg-cyan-400/10",
        icon: "border-cyan-300/35 bg-cyan-400/15 text-(--color-accent)",
        badge: "border-cyan-300/30 bg-cyan-400/15 text-(--color-accent)",
      };
    case "poc":
      return {
        card: "border-teal-300/40 bg-teal-400/10",
        icon: "border-teal-300/35 bg-teal-400/15 text-teal-100",
        badge: "border-teal-300/30 bg-teal-400/15 text-teal-100",
      };
    case "roi":
      return {
        card: "border-amber-300/40 bg-amber-400/10",
        icon: "border-amber-300/35 bg-amber-400/15 text-amber-100",
        badge: "border-amber-300/30 bg-amber-400/15 text-amber-100",
      };
    case "tco":
      return {
        card: "border-violet-300/35 bg-violet-400/10",
        icon: "border-violet-300/30 bg-violet-400/15 text-violet-100",
        badge: "border-violet-300/25 bg-violet-400/15 text-violet-100",
      };
  }
}

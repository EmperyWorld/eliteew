/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for Proof section (Fact / Hypothesis / FAQ objection tags).
 *
 * Related:
 * - ProofSection.tsx
 * - content/proof.ts
 */

export const PROOF_FACT_VISUAL = {
  sandbox: { badge: "Архитектура", claimClass: "Доказано" },
  agentless: { badge: "Реестр", claimClass: "Доказано" },
  instant: { badge: "Правообладатель", claimClass: "Доказано" },
} as const;

export const PROOF_HYPOTHESIS_VISUAL = {
  "sterile-disk": { badge: "NOT_READY", claimClass: "Проверяем" },
  latency: { badge: "Железо", claimClass: "Проверяем" },
  analog: { badge: "Обновления", claimClass: "Проверяем" },
} as const;

export const PROOF_FAQ_TAGS = [
  "Safe Workspace",
  "Реестр",
  "Цена",
  "Железо",
] as const;

export function hasVisualForFact(id: string): id is keyof typeof PROOF_FACT_VISUAL {
  return id in PROOF_FACT_VISUAL;
}

export function hasVisualForHypothesis(
  id: string,
): id is keyof typeof PROOF_HYPOTHESIS_VISUAL {
  return id in PROOF_HYPOTHESIS_VISUAL;
}

export function faqTagForIndex(index: number): string {
  return PROOF_FAQ_TAGS[index] ?? "Objection";
}

export function faqClaimLabel(kind: "fact" | "hypothesis"): string {
  return kind === "fact" ? "Fact" : "Hypothesis";
}

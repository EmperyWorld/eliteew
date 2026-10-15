/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for JTBD roles (buying committee + focus chips).
 *
 * Invariants:
 * - Keys align with jobs.roles ids; employee framing = separation, not surveillance.
 *
 * Related:
 * - JobsSection.tsx
 * - content/jobs.ts
 */

export const JOB_ROLE_VISUAL = {
  ciso: {
    step: "01",
    committee: "Decision Maker",
    focus: "Периметр данных",
    hireVerb: "Нанимает EliteEW, чтобы",
    stake: "Champion · влияет на выбор и внедрение",
    painLabel: "Боль",
    resonanceLabel: "Резонанс",
    tone: "lead" as const,
    badge: "Lead · Champion",
  },
  ceo: {
    step: "02",
    committee: "Economic Buyer",
    focus: "Активы и TCO",
    hireVerb: "Нанимает EliteEW, чтобы",
    stake: "Платит · решает по бюджету и риску",
    painLabel: "Боль",
    resonanceLabel: "Резонанс",
    tone: "buyer" as const,
    badge: "Budget · Risk",
  },
  employee: {
    step: "03",
    committee: "End User",
    focus: "Разделение · без вторжения",
    hireVerb: "Нанимает EliteEW, чтобы",
    stake: "Gatekeeper · саботирует или принимает контур",
    painLabel: "Боль",
    resonanceLabel: "Резонанс",
    tone: "user" as const,
    badge: "Separation first",
  },
} as const;

export type JobRoleVisualId = keyof typeof JOB_ROLE_VISUAL;

export function hasVisualForJobRole(id: string): id is JobRoleVisualId {
  return id in JOB_ROLE_VISUAL;
}

/** Ordered buying-committee strip for the section diagram. */
export const JOB_COMMITTEE_ORDER = [
  "ciso",
  "ceo",
  "employee",
] as const satisfies readonly JobRoleVisualId[];

export const JOB_COMMITTEE_META = {
  eyebrow: "Buying committee · Mid-market",
  caption:
    "Один продукт — три работы. Портреты ниже бьют в роль, которая читает экран.",
  flowHint: "принимает → оплачивает → принимает в работу",
} as const;

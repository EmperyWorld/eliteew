/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for Closer dual conversion paths (quiz light entry vs PoC).
 *
 * Invariants:
 * - Paths align with closer.ctas intents; no buy-or-leave framing.
 *
 * Related:
 * - CloserSection.tsx
 * - content/closer.ts
 */

export type CloserPathTone = "soft" | "hard";

export type CloserPathMeta = {
  intent: "quiz" | "poc";
  step: string;
  eyebrow: string;
  hint: string;
  friction: string;
  outcome: string;
  deliverable: string;
  tone: CloserPathTone;
};

export const CLOSER_PATHS: Record<"quiz" | "poc", CloserPathMeta> = {
  quiz: {
    intent: "quiz",
    step: "01",
    eyebrow: "Лёгкий вход",
    hint: "5 вопросов · профиль риска · без давления",
    friction: "~2 минуты",
    outcome: "Профиль готовности на экране → контакт по желанию",
    deliverable: "Профиль на экране",
    tone: "soft",
  },
  poc: {
    intent: "poc",
    step: "02",
    eyebrow: "Прямой путь",
    hint: "Порядок поставки EmpiierOS для закупки",
    friction: "Один запрос",
    outcome: "Комбинированный пакет в #contact (PoC и материалы)",
    deliverable: "Пакет в #contact",
    tone: "hard",
  },
};

export const CLOSER_META = {
  ladderHint: "аудит → профиль · или сразу PoC",
  noPressure: "оба пути без «купи или уходи»",
} as const;

export function closerPathForIntent(intent: string): CloserPathMeta | null {
  if (intent === "quiz") return CLOSER_PATHS.quiz;
  if (intent === "poc") return CLOSER_PATHS.poc;
  return null;
}

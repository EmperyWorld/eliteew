/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Visual metadata for Quiz section — light-entry express audit framing.
 *
 * Invariants:
 * - Qualitative profile only; no legal-audit claim; no score leak in options UI.
 *
 * Related:
 * - QuizSection.tsx · RiskQuiz.tsx
 * - content/quiz.ts
 */

export const QUIZ_META = {
  ladderHint: "вопросы → профиль → контакт по желанию",
  shellEyebrow: "Шаги экспресс-аудита",
  resultNextEyebrow: "Следующий шаг · по желанию",
  resultNextHint:
    "Оставьте контакт для разбора зон или перейдите к комбинированному пакету",
  optionMarks: ["А", "Б", "В", "Г"] as const,
} as const;

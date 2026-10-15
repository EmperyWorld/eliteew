/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure quiz progress math for RiskQuiz progressbar / step strip.
 *
 * Invariants:
 * - progressPct is 0–100; cosmetic only (scoring stays in quizScore).
 *
 * Related:
 * - RiskQuiz.tsx
 */

export function quizProgressPct(step: number, total: number, done: boolean): number {
  if (done || total <= 0) return 100;
  const clamped = Math.min(Math.max(step, 0), total - 1);
  return Math.round(((clamped + 1) / total) * 100);
}

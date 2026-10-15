/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Pure quiz scoring → risk profile (unit-testable).
 *
 * Invariants:
 * - Unknown question/option ids contribute 0; never throw on partial answers.
 *
 * Related:
 * - content/quiz.ts
 */

import { quiz, riskProfiles, type RiskProfileId } from "@/content/quiz";

export type QuizAnswers = Record<string, string>;

export type QuizScoreResult = {
  score: number;
  maxScore: number;
  riskProfileId: RiskProfileId;
  riskTitle: string;
  riskSummary: string;
};

export function scoreQuizAnswers(answers: QuizAnswers): QuizScoreResult {
  let score = 0;
  let maxScore = 0;

  for (const question of quiz.questions) {
    const optionScores = question.options.map((o) => o.score);
    maxScore += Math.max(...optionScores);
    const selected = answers[question.id];
    const opt = question.options.find((o) => o.id === selected);
    if (opt) score += opt.score;
  }

  let riskProfileId: RiskProfileId = "high";
  if (score <= riskProfiles.low.maxScoreInclusive) riskProfileId = "low";
  else if (score <= riskProfiles.medium.maxScoreInclusive) riskProfileId = "medium";

  const profile = riskProfiles[riskProfileId];
  return {
    score,
    maxScore,
    riskProfileId,
    riskTitle: profile.title,
    riskSummary: profile.summary,
  };
}

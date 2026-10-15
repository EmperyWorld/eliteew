/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock quiz visual meta — light entry, no legal-audit / buy pressure.
 *
 * Related:
 * - quizVisual.ts
 * - content/quiz.ts
 */

import { describe, expect, it } from "vitest";
import { quiz } from "@/content";
import { QUIZ_META } from "./quizVisual";

describe("quizVisual", () => {
  it("frames soft ladder without CRM pressure", () => {
    expect(QUIZ_META.ladderHint).toMatch(/профиль/i);
    expect(QUIZ_META.resultNextHint.toLowerCase()).toMatch(/по желанию|пакет/);
    const blob = JSON.stringify(QUIZ_META).toLowerCase();
    expect(blob).not.toContain("купите");
    expect(blob).not.toContain("юридическ");
  });

  it("keeps option marks for denser choice UI", () => {
    expect(QUIZ_META.optionMarks.length).toBeGreaterThanOrEqual(3);
    expect(quiz.questions.length).toBe(5);
    expect(quiz.flowHint).toMatch(/5 вопрос/i);
  });
});

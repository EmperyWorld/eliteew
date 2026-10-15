/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock quiz progress percent helper.
 *
 * Related:
 * - quizProgress.ts
 */

import { describe, expect, it } from "vitest";
import { quizProgressPct } from "@/lib/quizProgress";

describe("quizProgressPct", () => {
  it("maps first and last question through the bar", () => {
    expect(quizProgressPct(0, 5, false)).toBe(20);
    expect(quizProgressPct(4, 5, false)).toBe(100);
  });

  it("returns 100 when done", () => {
    expect(quizProgressPct(0, 5, true)).toBe(100);
  });
});

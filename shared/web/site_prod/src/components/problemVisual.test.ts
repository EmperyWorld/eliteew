/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock problem visual keys to content scenario/gap ids.
 *
 * Invariants:
 * - Every problem.scenarios / gaps id has visual metadata.
 *
 * Related:
 * - problemVisual.ts
 * - content/problem.ts
 */

import { describe, expect, it } from "vitest";
import { problem } from "@/content";
import {
  hasVisualForGap,
  hasVisualForScenario,
  PROBLEM_GAP_VISUAL,
  PROBLEM_PERIMETER_META,
  PROBLEM_SCENARIO_VISUAL,
} from "./problemVisual";

describe("problemVisual", () => {
  it("covers every problem scenario id", () => {
    for (const s of problem.scenarios) {
      expect(hasVisualForScenario(s.id)).toBe(true);
      expect(
        PROBLEM_SCENARIO_VISUAL[s.id as keyof typeof PROBLEM_SCENARIO_VISUAL]
          .leakVia.length,
      ).toBeGreaterThan(0);
      expect(
        PROBLEM_SCENARIO_VISUAL[s.id as keyof typeof PROBLEM_SCENARIO_VISUAL]
          .badge.length,
      ).toBeGreaterThan(0);
    }
  });

  it("covers every problem gap id", () => {
    for (const g of problem.gaps) {
      expect(hasVisualForGap(g.id)).toBe(true);
      expect(
        PROBLEM_GAP_VISUAL[g.id as keyof typeof PROBLEM_GAP_VISUAL].blindSpot
          .length,
      ).toBeGreaterThan(0);
      expect(["door", "agent"]).toContain(
        PROBLEM_GAP_VISUAL[g.id as keyof typeof PROBLEM_GAP_VISUAL].tone,
      );
    }
  });

  it("locks perimeter door/windows contrast meta", () => {
    expect(PROBLEM_PERIMETER_META.contrastHint).toMatch(/окна открыты/i);
    expect(PROBLEM_PERIMETER_META.windows.channels).toHaveLength(3);
    expect(PROBLEM_PERIMETER_META.door.status.toLowerCase()).toContain("дверь");
    expect(PROBLEM_PERIMETER_META.windows.status.toLowerCase()).toContain("окна");
  });

  it("locks problem section header chips and subsection labels", () => {
    expect(problem.eyebrow.toLowerCase()).toMatch(/контекст|продукт/);
    expect(problem.audienceChips.length).toBeGreaterThanOrEqual(3);
    expect(problem.audienceChips.join(" ").toLowerCase()).toMatch(/облак|реестр/);
    expect(problem.scenariosEyebrow.length).toBeGreaterThan(0);
    expect(problem.messageLabel.length).toBeGreaterThan(0);
  });

  it("keeps fluff words out of visual labels", () => {
    const blob = JSON.stringify({
      PROBLEM_SCENARIO_VISUAL,
      PROBLEM_GAP_VISUAL,
      PROBLEM_PERIMETER_META,
    }).toLowerCase();
    for (const word of ["уникальн", "революцион", "лучш"]) {
      expect(blob).not.toContain(word);
    }
  });
});

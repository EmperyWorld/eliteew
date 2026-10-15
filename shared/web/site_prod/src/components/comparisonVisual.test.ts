/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock comparison visual keys to content row criteria.
 *
 * Invariants:
 * - Every comparison.rows criterion has visual tags.
 *
 * Related:
 * - comparisonVisual.ts
 * - content/comparison.ts
 */

import { describe, expect, it } from "vitest";
import { comparison } from "@/content";
import {
  COMPARISON_META,
  COMPARISON_ROW_VISUAL,
  COMPARISON_SPEED,
  hasVisualForCriterion,
} from "./comparisonVisual";

describe("comparisonVisual", () => {
  it("covers every comparison.rows criterion", () => {
    for (const row of comparison.rows) {
      expect(hasVisualForCriterion(row.criterion)).toBe(true);
      expect(COMPARISON_ROW_VISUAL[row.criterion].eliteTag.length).toBeGreaterThan(0);
    }
  });

  it("speed contrast frames hours/days vs months without fake TCO numbers", () => {
    expect(COMPARISON_SPEED.dlp.scale.toLowerCase()).toMatch(/облак|диск|не диск/);
    expect(COMPARISON_SPEED.elite.scale.toLowerCase()).toMatch(/локальн|сеанс/);
    expect(COMPARISON_SPEED.dlp.status.length).toBeGreaterThan(0);
    expect(COMPARISON_SPEED.elite.status.length).toBeGreaterThan(0);
    expect(COMPARISON_META.contrastHint).toMatch(/облак|диск/i);
    expect(COMPARISON_META.leadCriterion).toBe("Где работает");
    const blob = JSON.stringify(COMPARISON_SPEED);
    expect(blob).not.toMatch(/\$|€|₽|\d+\s*%/);
  });

  it("locks differentiation header chips", () => {
    expect(comparison.audienceChips.length).toBeGreaterThanOrEqual(3);
    expect(comparison.audienceChips.join(" ").toLowerCase()).toMatch(/safe workspace|fedora|облак/);
    expect(comparison.killerLabel.length).toBeGreaterThan(0);
  });

  it("keeps fluff out of visual tags", () => {
    const blob = JSON.stringify({
      COMPARISON_ROW_VISUAL,
      COMPARISON_META,
    }).toLowerCase();
    for (const word of ["уникальн", "революцион", "лучш"]) {
      expect(blob).not.toContain(word);
    }
  });
});

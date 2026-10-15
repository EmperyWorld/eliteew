/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock solution visual keys to content pillar ids; ban fluff in visual layer.
 *
 * Invariants:
 * - Every solution.pillars id has visual metadata.
 *
 * Related:
 * - solutionVisual.ts
 * - content/solution.ts
 */

import { describe, expect, it } from "vitest";
import { solution } from "@/content";
import {
  hasVisualForPillar,
  SOLUTION_CTA_PATHS,
  SOLUTION_LAYER_CAPTION,
  SOLUTION_LAYER_DEMO,
  SOLUTION_LAYER_STACK,
  SOLUTION_PILLAR_VISUAL,
  SOLUTION_PILLARS_META,
} from "./solutionVisual";

describe("solutionVisual", () => {
  it("covers every solution.pillars id", () => {
    for (const p of solution.pillars) {
      expect(hasVisualForPillar(p.id)).toBe(true);
      expect(SOLUTION_PILLAR_VISUAL[p.id].layerHint.length).toBeGreaterThan(0);
      expect(SOLUTION_PILLAR_VISUAL[p.id].techLabel.length).toBeGreaterThan(0);
      expect(SOLUTION_PILLAR_VISUAL[p.id].badge.length).toBeGreaterThan(0);
      expect(["lead", "access", "speed"]).toContain(
        SOLUTION_PILLAR_VISUAL[p.id].tone,
      );
      expect(p.result.length).toBeGreaterThan(0);
    }
    expect(SOLUTION_PILLARS_META.flowHint).toMatch(/пол|установк/i);
    expect(solution.pillarsEyebrow.length).toBeGreaterThan(0);
    expect(solution.trustNotes.length).toBeGreaterThanOrEqual(3);
    expect(solution.trustNotes.join(" ")).toMatch(/x86_64|реестр/i);
  });

  it("layer stack is cloud confusion under EmpiierOS dome", () => {
    expect(SOLUTION_LAYER_STACK.map((l) => l.id)).toEqual(["device", "dome"]);
    expect(SOLUTION_LAYER_STACK[0]?.letter).toBe("A");
    expect(SOLUTION_LAYER_STACK[1]?.letter).toBe("B");
    expect(SOLUTION_LAYER_CAPTION.length).toBeGreaterThan(0);
    expect(SOLUTION_LAYER_DEMO.href).toBe("#hook");
  });

  it("exposes dual CTA paths for PoC and Transformation", () => {
    expect(SOLUTION_CTA_PATHS.poc.eyebrow).toMatch(/Пилот/i);
    expect(SOLUTION_CTA_PATHS.transform.hint).toMatch(/hero|Layering|описан/i);
    expect(solution.transformHref).toBe("/empiieros/description");
  });

  it("keeps fluff out of visual labels", () => {
    const blob = JSON.stringify({
      SOLUTION_PILLAR_VISUAL,
      SOLUTION_LAYER_STACK,
      SOLUTION_CTA_PATHS,
    }).toLowerCase();
    for (const word of ["уникальн", "революцион", "лучш", "слежка"]) {
      expect(blob).not.toContain(word);
    }
  });
});

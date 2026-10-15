/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock closer dual-path intents to content CTAs.
 *
 * Invariants:
 * - quiz + poc paths exist; closer.ctas intents are covered.
 *
 * Related:
 * - closerVisual.ts
 * - content/closer.ts
 */

import { describe, expect, it } from "vitest";
import { closer } from "@/content";
import {
  CLOSER_META,
  CLOSER_PATHS,
  closerPathForIntent,
} from "./closerVisual";

describe("closerVisual", () => {
  it("covers every closer.ctas intent", () => {
    for (const cta of closer.ctas) {
      expect(closerPathForIntent(cta.intent)).not.toBeNull();
    }
    expect(Object.keys(CLOSER_PATHS).sort()).toEqual(["poc", "quiz"]);
  });

  it("keeps light-entry framing without buy-or-leave pressure", () => {
    const blob = JSON.stringify({ ...CLOSER_PATHS, ...CLOSER_META }).toLowerCase();
    expect(blob).toContain("лёгкий вход");
    expect(blob).not.toContain("купите");
    expect(blob).not.toContain("только сегодня");
    expect(closer.flowHint.toLowerCase()).toMatch(/без давления/);
    expect(CLOSER_META.noPressure).toMatch(/без/i);
  });

  it("exposes friction, outcome, deliverable, and tones for both paths", () => {
    expect(CLOSER_PATHS.quiz.friction.length).toBeGreaterThan(0);
    expect(CLOSER_PATHS.quiz.tone).toBe("soft");
    expect(CLOSER_PATHS.poc.tone).toBe("hard");
    expect(CLOSER_PATHS.quiz.deliverable.length).toBeGreaterThan(0);
    expect(CLOSER_PATHS.poc.outcome).toMatch(/contact|PoC|пакет/i);
  });
});

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock quiz scoring thresholds and lead schema validation.
 *
 * Related:
 * - lib/quizScore.ts, lib/leadSchema.ts
 */

import { describe, expect, it } from "vitest";
import { leadPayloadSchema } from "@/lib/leadSchema";
import { scoreQuizAnswers } from "@/lib/quizScore";
import { allowRequest } from "@/lib/rateLimit";

describe("scoreQuizAnswers", () => {
  it("maps low scores to low profile", () => {
    const r = scoreQuizAnswers({
      messengers: "often",
      byod: "yes",
      dlp: "no",
      size: "mid",
      pilot: "ready",
    });
    expect(r.score).toBeLessThanOrEqual(4);
    expect(r.riskProfileId).toBe("low");
  });

  it("maps high mismatch answers to high profile", () => {
    const r = scoreQuizAnswers({
      messengers: "rare",
      byod: "no",
      dlp: "yes",
      size: "large",
      pilot: "blocked",
    });
    expect(r.riskProfileId).toBe("high");
    expect(r.riskTitle).toMatch(/разрыв/i);
  });
});

describe("quiz content steps", () => {
  it("exposes shortLabel for each question", async () => {
    const { quiz } = await import("@/content/quiz");
    expect(quiz.questions.every((q) => q.shortLabel.length > 0)).toBe(true);
    expect(quiz.chips.length).toBeGreaterThanOrEqual(3);
  });
});

describe("leadPayloadSchema", () => {
  it("accepts demo lead", () => {
    const parsed = leadPayloadSchema.safeParse({
      intent: "demo",
      contact: { email: "a@b.co", companySize: "100-1000" },
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid email", () => {
    const parsed = leadPayloadSchema.safeParse({
      intent: "poc",
      contact: { email: "nope", companySize: "1-99" },
    });
    expect(parsed.success).toBe(false);
  });
});

describe("allowRequest", () => {
  it("blocks after limit", () => {
    const key = `test-${Date.now()}`;
    for (let i = 0; i < 12; i++) {
      expect(allowRequest(key, 12, 60_000).ok).toBe(true);
    }
    expect(allowRequest(key, 12, 60_000).ok).toBe(false);
  });
});

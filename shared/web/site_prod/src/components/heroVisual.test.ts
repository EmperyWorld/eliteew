/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock Hero path intents and trust-signal vocabulary.
 *
 * Invariants:
 * - Quiz + demo paths present; no surveillance language in trust chips.
 *
 * Related:
 * - heroVisual.ts
 */

import { describe, expect, it } from "vitest";
import { hero } from "@/content";
import {
  HERO_TRUST_SIGNALS,
  heroPathForIntent,
} from "@/components/heroVisual";

describe("heroVisual", () => {
  it("maps soft quiz and hard demo paths", () => {
    expect(heroPathForIntent("quiz")?.eyebrow).toMatch(/01|Мягкий/i);
    expect(heroPathForIntent("demo")?.eyebrow).toMatch(/02|Прямой/i);
    expect(heroPathForIntent("poc")).toBeUndefined();
  });

  it("splits Hook H1 into cloud vs disk framing", () => {
    expect(hero.h1Pain).toMatch(/облак|диск/i);
    expect(hero.h1Pain).not.toMatch(/Telegram|WhatsApp|ChatGPT/i);
    expect(hero.h1Promise).toMatch(/EmpiierOS/i);
    expect(hero.audienceChips.length).toBeGreaterThanOrEqual(3);
  });

  it("keeps trust chips factual for EmpiierOS", () => {
    const joined = HERO_TRUST_SIGNALS.map((s) => s.label).join(" ");
    expect(joined).toMatch(/x86_64|реестр/i);
    expect(joined).not.toMatch(/мониторинг|слежка за сотруд/i);
  });
});

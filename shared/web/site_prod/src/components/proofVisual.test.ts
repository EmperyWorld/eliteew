/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock proof visual keys to content fact/hypothesis ids; ban absolute guarantees.
 *
 * Invariants:
 * - Every proof.facts / hypotheses id has visual metadata.
 * - FAQ tag count matches faq length.
 *
 * Related:
 * - proofVisual.ts
 * - content/proof.ts
 */

import { describe, expect, it } from "vitest";
import { proof } from "@/content";
import {
  faqClaimLabel,
  faqTagForIndex,
  hasVisualForFact,
  hasVisualForHypothesis,
  PROOF_FACT_VISUAL,
  PROOF_FAQ_TAGS,
  PROOF_HYPOTHESIS_VISUAL,
} from "./proofVisual";

describe("proofVisual", () => {
  it("covers every proof.facts and hypotheses id", () => {
    for (const f of proof.facts) {
      expect(hasVisualForFact(f.id)).toBe(true);
      expect(PROOF_FACT_VISUAL[f.id].claimClass).toBe("Доказано");
    }
    for (const h of proof.hypotheses) {
      expect(hasVisualForHypothesis(h.id)).toBe(true);
      expect(PROOF_HYPOTHESIS_VISUAL[h.id].claimClass).toBe("Проверяем");
    }
  });

  it("maps FAQ tags 1:1 with proof.faq", () => {
    expect(PROOF_FAQ_TAGS).toHaveLength(proof.faq.length);
    expect(faqTagForIndex(0)).toBe(PROOF_FAQ_TAGS[0]);
    for (let i = 0; i < proof.faq.length; i++) {
      expect(proof.faq[i]?.tag).toBe(PROOF_FAQ_TAGS[i]);
    }
  });

  it("labels claim kinds for FAQ chips", () => {
    expect(faqClaimLabel("fact")).toBe("Fact");
    expect(faqClaimLabel("hypothesis")).toBe("Hypothesis");
  });

  it("bans absolute guarantee wording in visual layer", () => {
    const blob = JSON.stringify({
      PROOF_FACT_VISUAL,
      PROOF_HYPOTHESIS_VISUAL,
      PROOF_FAQ_TAGS,
    }).toLowerCase();
    for (const word of ["100%", "абсолютн", "уникальн", "революцион"]) {
      expect(blob).not.toContain(word);
    }
  });

  it("exposes honest whitepaper placeholder status", () => {
    expect(proof.expertKit.whitepaperStatus.toLowerCase()).toMatch(/empiieros|description|страниц/);
    expect(proof.expertKit.contactCtaHref).toBe("#contact");
  });
});

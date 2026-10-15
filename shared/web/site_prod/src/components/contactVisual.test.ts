/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock contact pack visual meta to leadBundle interest ids.
 *
 * Related:
 * - contactVisual.ts
 * - leadBundle.ts
 */

import { describe, expect, it } from "vitest";
import { LEAD_BUNDLE_OPTIONS } from "./leadBundle";
import {
  CONTACT_INTEREST_VISUAL,
  CONTACT_META,
  contactInterestToneClass,
} from "./contactVisual";

describe("contactVisual", () => {
  it("covers every lead bundle interest with a step", () => {
    for (const opt of LEAD_BUNDLE_OPTIONS) {
      expect(CONTACT_INTEREST_VISUAL[opt.id]?.step).toMatch(/^\d{2}$/);
    }
    expect(Object.keys(CONTACT_INTEREST_VISUAL).sort()).toEqual(
      LEAD_BUNDLE_OPTIONS.map((o) => o.id).sort(),
    );
  });

  it("frames one-POST ladder without SLA promises", () => {
    expect(CONTACT_META.ladderHint).toMatch(/один POST/i);
    const blob = JSON.stringify(CONTACT_META).toLowerCase();
    expect(blob).not.toMatch(/sla|гарант|100%/);
  });

  it("returns denser selected tone classes", () => {
    const off = contactInterestToneClass("poc", false);
    const on = contactInterestToneClass("poc", true);
    expect(off.card).toContain("border-white/10");
    expect(on.card).toContain("teal");
  });
});

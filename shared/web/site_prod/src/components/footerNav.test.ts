/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock footer nav anchors to known landing section ids.
 *
 * Related:
 * - footerNav.ts
 */

import { describe, expect, it } from "vitest";
import { FOOTER_NAV } from "./footerNav";

describe("footerNav", () => {
  it("uses in-page hashes only", () => {
    expect(FOOTER_NAV.length).toBeGreaterThanOrEqual(5);
    for (const item of FOOTER_NAV) {
      expect(item.href.startsWith("#")).toBe(true);
      expect(item.label.length).toBeGreaterThan(0);
    }
  });

  it("includes contact and quiz exits", () => {
    const hrefs = FOOTER_NAV.map((i) => i.href);
    expect(hrefs).toContain("#contact");
    expect(hrefs).toContain("#quiz");
  });

  it("maps problem to #problem (not hero #hook)", () => {
    const problem = FOOTER_NAV.find((i) => i.label === "Проблема");
    expect(problem?.href).toBe("#problem");
    const hook = FOOTER_NAV.find((i) => i.href === "#hook");
    expect(hook?.label).toBe("Старт");
    expect(hook?.label).not.toBe("Крючок");
  });
});

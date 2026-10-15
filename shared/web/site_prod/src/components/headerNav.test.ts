/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock header nav anchors to known landing sections.
 *
 * Related:
 * - headerNav.ts
 */

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { BRAND_LOGO } from "./BrandLogo";
import { HEADER_META, HEADER_NAV, headerSectionId } from "./headerNav";

describe("headerNav", () => {
  it("uses compact in-page hashes", () => {
    expect(HEADER_NAV.length).toBeGreaterThanOrEqual(3);
    for (const item of HEADER_NAV) {
      expect(item.href.startsWith("#")).toBe(true);
      expect(headerSectionId(item.href).length).toBeGreaterThan(0);
    }
  });

  it("includes solution and quiz exits", () => {
    const hrefs = HEADER_NAV.map((i) => i.href);
    expect(hrefs).toContain("#solution");
    expect(hrefs).toContain("#quiz");
  });

  it("locks header chrome meta without absolute security claims", () => {
    expect(HEADER_META.sessionLabel).toMatch(/x86_64/i);
    expect(HEADER_META.contactCta.length).toBeGreaterThan(0);
    expect(HEADER_META.sessionLabel.toLowerCase()).not.toContain("100%");
  });

  it("uses BrandLogo image mark instead of EW text glyph", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/SiteHeader.tsx"),
      "utf8",
    );
    expect(src).toContain("BrandLogo");
    expect(src).not.toMatch(/brandMark|"EW"/);
    expect(BRAND_LOGO.src).toBe("/logo_empery.png");
  });
});

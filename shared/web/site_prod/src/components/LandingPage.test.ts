/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Lock landing story sections to open page background (no shared Section glass bubble).
 *
 * Related:
 * - LandingPage.tsx
 * - Section.tsx
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("LandingPage section shell", () => {
  it("does not wrap story sections in Section glass bubble", () => {
    const src = readFileSync(
      join(process.cwd(), "src/components/LandingPage.tsx"),
      "utf8",
    );
    expect(src).not.toMatch(/\bglass\b/);
    expect(src).toContain('<Section id="problem">');
    expect(src).toContain('<Section id="comparison">');
    expect(src).toContain('<Section id="closer">');
    expect(src).toContain('<Section id="quiz">');
    expect(src).toContain('<Section id="contact">');
  });
});

/**
 * ---
 * EliteEW · Empery World · https://empery.world
 * Author: po&T && TZBrand
 * ---
 *
 * Purpose:
 * Contract lock for the public MIT source link in the site footer.
 *
 * Related:
 * - SiteFooter.tsx
 * - ../content/brand.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { brand } from "../content";

describe("SiteFooter legal links", () => {
  it("publishes the canonical source repository with the MIT label", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/SiteFooter.tsx"),
      "utf8",
    );

    expect(brand.sourceUrl).toBe("https://github.com/EmperyWorld/eliteew");
    expect(source).toContain("href={brand.sourceUrl}");
    expect(source).toContain("Исходный код · MIT");
  });
});
